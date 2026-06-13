import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Trash2, RefreshCw, RotateCcw, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, Users } from "lucide-react";
import { formatDateTimeID } from "@/lib/utils";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { useWsEvent } from "@/hooks/useWebSocket";
import {
  deleteAccount,
  fetchAccounts,
  loginAccount,
  loginAccounts,
  openPanel,
  toggleAccountEnabled,
  toggleAllAccounts,
  warmupAccount,
  warmupAllAccounts,
} from "@/lib/api";

type Provider = "kiro" | "kiro-pro" | "codebuddy" | "canva" | "codex" | "qoder";
type Status = "active" | "exhausted" | "error" | "pending" | "disabled";

interface CodexQuotaWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_at: string | null;
  reset_after_seconds: number;
}

interface CodexQuotaMetadata {
  plan_type?: string;
  primary?: CodexQuotaWindow;
  secondary?: CodexQuotaWindow;
  rate_limited?: boolean;
}

interface Account {
  id: number;
  email: string;
  provider: Provider;
  status: Status;
  enabled?: boolean;
  quotaLimit?: number;
  quotaRemaining?: number;
  lastUsedAt?: string | null;
  lastLoginAt?: string | null;
  errorMessage?: string | null;
  metadata?: {
    codex_quota?: CodexQuotaMetadata;
    overage?: { enabled: boolean; capable: boolean; used: number; cap: number; remaining: number } | null;
    inferenceProbe?: string;
  } | null;
}

const statusColors: Record<string, string> = {
  active: "var(--success)",
  exhausted: "var(--warning)",
  error: "var(--error)",
  pending: "var(--muted-foreground)",
  disabled: "var(--muted-foreground)",
};

function labelProvider(provider: string) {
  if (provider === "kiro-pro") return "Kiro Pro";
  return provider === "codebuddy" ? "CodeBuddy" : provider.charAt(0).toUpperCase() + provider.slice(1);
}

function formatCredit(value?: number | null) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : "0.0";
}

function timeAgo(value?: string | null): string {
  if (!value) return "—";
  const now = Date.now();
  const then = new Date(value.endsWith("Z") ? value : `${value}Z`).getTime();
  const diff = now - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return formatDateTimeID(value);
}

function formatWindow(seconds: number) {
  if (!seconds || seconds <= 0) return "?";
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  return `${Math.round(seconds / 60)}m`;
}

function formatResetIn(seconds: number) {
  if (!seconds || seconds <= 0) return "now";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function CodexQuotaCell({ codex, fallbackRemaining, fallbackLimit }: { codex?: CodexQuotaMetadata; fallbackRemaining?: number; fallbackLimit?: number }) {
  if (!codex || (!codex.primary && !codex.secondary)) {
    return <CreditBar remaining={Number(fallbackRemaining || 0)} total={Number(fallbackLimit || 0)} />;
  }
  const renderBar = (label: string, w?: CodexQuotaWindow) => {
    if (!w) return null;
    const used = Math.max(0, Math.min(100, w.used_percent || 0));
    const remaining = 100 - used;
    const color = remaining <= 10 ? "var(--error)" : remaining <= 40 ? "var(--warning)" : "var(--success)";
    return (
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
          <span>{label} ({formatWindow(w.limit_window_seconds)})</span>
          <span>{remaining.toFixed(0)}% · {formatResetIn(w.reset_after_seconds)}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--secondary)] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${remaining}%`, backgroundColor: color }} />
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-1.5 min-w-[160px]">
      {codex.plan_type && <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{codex.plan_type}{codex.rate_limited && <span className="ml-1 text-[var(--error)]">RATE LIMITED</span>}</div>}
      {renderBar("Session", codex.primary)}
      {renderBar("Weekly", codex.secondary)}
    </div>
  );
}

function CreditBar({ remaining, total }: { remaining: number; total: number }) {
  if (total <= 0) return <span className="text-xs text-[var(--muted-foreground)]">—</span>;
  const percent = Math.round((remaining / total) * 100);
  const color = percent <= 10 ? "var(--error)" : percent <= 30 ? "var(--warning)" : "var(--success)";
  return (
    <div className="min-w-[100px] space-y-0.5">
      <div className="h-1.5 rounded-full bg-[var(--secondary)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
        {formatCredit(remaining)}/{formatCredit(total)}
      </div>
    </div>
  );
}

type SortKey = "email" | "status" | "enabled" | "credit" | "lastLogin";
type SortDir = "asc" | "desc";

export default function AccountList() {
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 25;
  const { message, setMessage: setTimedMessage, clearMessage } = useTimedMessage<string>(null, 4000);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetchAccounts() as { data: Account[] };
      setAccounts((res.data || []).filter((a) => a.provider === provider));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [provider]);

  function showSuccess(text: string) { setTimedMessage(text); setError(null); }
  function showError(err: unknown) { setError(err instanceof Error ? err.message : String(err)); clearMessage(); }

  async function handleWarmup(id: number) {
    try { await warmupAccount(id); showSuccess(`WarmUp queued #${id}`); await load(); } catch (err) { showError(err); }
  }

  async function handleWarmupAll() {
    try {
      const res = await warmupAllAccounts({ providers: [provider!], statuses: ["active", "exhausted", "error"] }) as any;
      showSuccess(res.message || "WarmUp All queued.");
      await load();
    } catch (err) { showError(err); }
  }

  async function handleLogin(id: number) {
    try { await loginAccount(id); showSuccess(`Login queued #${id}`); await load(); } catch (err) { showError(err); }
  }

  async function handleOpenPanel(id: number) {
    try { await openPanel(id); showSuccess(`Panel opened #${id}`); } catch (err) { showError(err); }
  }

  async function handleRetryErrors() {
    const ids = accounts.filter((a) => a.status === "error").map((a) => a.id);
    if (ids.length === 0) return;
    await loginAccounts(ids);
    showSuccess(`Queued ${ids.length} error accounts for retry.`);
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm(`Delete account #${id}?`)) return;
    try { await deleteAccount(id); showSuccess(`Deleted #${id}`); await load(); } catch (err) { showError(err); }
  }

  async function handleDeleteFiltered() {
    const target = statusFilter === "all" ? filtered : filtered.filter((a) => a.status === statusFilter);
    if (target.length === 0) return;

    const label = statusFilter === "all" ? "all filtered" : statusFilter;
    if (!confirm(`Delete ${target.length} ${label} account(s)? This cannot be undone.`)) return;

    let deleted = 0;
    let failed = 0;
    for (const account of target) {
      try {
        await deleteAccount(account.id);
        deleted++;
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      showSuccess(`Deleted ${deleted} accounts, ${failed} failed`);
    } else {
      showSuccess(`Deleted ${deleted} accounts`);
    }
    await load();
  }

  async function handleToggle(id: number, currentEnabled: boolean) {
    const next = !currentEnabled;
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: next } : a)));
    try {
      await toggleAccountEnabled(id, next);
      showSuccess(next ? `Enabled #${id}` : `Disabled #${id}`);
    } catch (err) {
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: currentEnabled } : a)));
      showError(err);
    }
  }

  async function handleToggleAll(enabled: boolean) {
    if (!provider) return;
    const prev = accounts.map((a) => ({ id: a.id, enabled: a.enabled !== false }));
    setAccounts((prev) => prev.map((a) => ({ ...a, enabled })));
    try {
      const res = await toggleAllAccounts(provider, enabled);
      showSuccess(enabled ? `Enabled ${res.count} accounts` : `Disabled ${res.count} accounts`);
    } catch (err) {
      setAccounts((list) => list.map((a) => {
        const orig = prev.find((p) => p.id === a.id);
        return orig ? { ...a, enabled: orig.enabled } : a;
      }));
      showError(err);
    }
  }

  const reloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = () => {
    if (reloadRef.current) clearTimeout(reloadRef.current);
    reloadRef.current = setTimeout(() => { load(); }, 800);
  };
  useEffect(() => () => { if (reloadRef.current) clearTimeout(reloadRef.current); }, []);
  useWsEvent(["account_status", "account_updated", "warmup_success", "warmup_exhausted"], scheduleReload);

  const filtered = useMemo(() => {
    let result = accounts.filter((a) => a.email.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "enabled":
          cmp = (a.enabled === false ? 0 : 1) - (b.enabled === false ? 0 : 1);
          break;
        case "credit":
          cmp = (a.quotaRemaining ?? 0) - (b.quotaRemaining ?? 0);
          break;
        case "lastLogin": {
          const da = new Date(a.lastLoginAt || a.lastUsedAt || 0).getTime();
          const db = new Date(b.lastLoginAt || b.lastUsedAt || 0).getTime();
          cmp = da - db;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [accounts, search, statusFilter, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [search, provider, statusFilter]);

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const exhaustedCount = accounts.filter((a) => a.status === "exhausted").length;
  const errorCount = accounts.filter((a) => a.status === "error").length;
  const pendingCount = accounts.filter((a) => a.status === "pending").length;
  const enabledCount = accounts.filter((a) => a.enabled !== false).length;
  const disabledCount = accounts.filter((a) => a.enabled === false).length;
  const totalQuotaLimit = accounts.reduce((s, a) => s + (a.quotaLimit || 0), 0);
  const totalQuotaRemaining = accounts.reduce((s, a) => s + (a.quotaRemaining || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/accounts")} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{labelProvider(provider || "")}</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{accounts.length} accounts</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleWarmupAll}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Warmup All
          </Button>
          {errorCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleRetryErrors}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry Errors ({errorCount})
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      {(message || error) && (
        <div className={`rounded-lg p-3 text-sm border ${message ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" : "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20"}`}>
          {message || error}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--success)]">{activeCount}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Active</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--warning)]">{exhaustedCount}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Exhausted</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--error)]">{errorCount}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Error</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--muted-foreground)]">{pendingCount}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Pending</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-center col-span-2 sm:col-span-1">
          <p className="text-lg font-bold text-[var(--foreground)]">{formatCredit(totalQuotaRemaining)}<span className="text-sm text-[var(--muted-foreground)]">/{formatCredit(totalQuotaLimit)}</span></p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Quota</p>
        </div>
      </div>

      {/* Search, Filter & Bulk Actions */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <Input placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "active", "exhausted", "error", "pending"] as const).map((s) => {
              const count = s === "all" ? accounts.length : accounts.filter(a => a.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                    statusFilter === s
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => handleToggleAll(true)} disabled={disabledCount === 0}>
              <CheckCircle2 className="w-3 h-3 text-[var(--success)]" /> Enable All
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => handleToggleAll(false)} disabled={enabledCount === 0}>
              <XCircle className="w-3 h-3 text-[var(--error)]" /> Disable All
            </Button>
            <div className="w-px h-4 bg-[var(--border)]" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-[var(--error)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
              onClick={handleDeleteFiltered}
              disabled={filtered.length === 0}
            >
              <Trash2 className="w-3 h-3" />
              Delete {statusFilter !== "all" ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : "All"} ({filtered.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="border-[var(--border)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/30">
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 cursor-pointer select-none hover:text-[var(--foreground)]" onClick={() => handleSort("email")}>
                    <span className="inline-flex items-center">Email<SortIcon column="email" /></span>
                  </th>
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 cursor-pointer select-none hover:text-[var(--foreground)]" onClick={() => handleSort("status")}>
                    <span className="inline-flex items-center">Status<SortIcon column="status" /></span>
                  </th>
                  <th className="text-center text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 cursor-pointer select-none hover:text-[var(--foreground)]" onClick={() => handleSort("enabled")}>
                    <span className="inline-flex items-center">On<SortIcon column="enabled" /></span>
                  </th>
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 cursor-pointer select-none hover:text-[var(--foreground)] hidden sm:table-cell" onClick={() => handleSort("credit")}>
                    <span className="inline-flex items-center">Credit<SortIcon column="credit" /></span>
                  </th>
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 cursor-pointer select-none hover:text-[var(--foreground)] hidden md:table-cell" onClick={() => handleSort("lastLogin")}>
                    <span className="inline-flex items-center">Last Active<SortIcon column="lastLogin" /></span>
                  </th>
                  <th className="text-right text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * perPage, page * perPage).map((account) => {
                  const isEnabled = account.enabled !== false;
                  return (
                  <tr key={account.id} className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--secondary)]/30 transition-colors ${isEnabled ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3">
                      <div className="text-sm text-[var(--foreground)]">{account.email}</div>
                      {account.errorMessage && (
                        <div className="text-[11px] text-[var(--error)] mt-0.5 line-clamp-1 max-w-[250px]" title={account.errorMessage}>{account.errorMessage}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[account.status] || "var(--muted-foreground)" }} />
                        <span className="capitalize text-[var(--foreground)]">{account.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        onClick={() => handleToggle(account.id, isEnabled)}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${isEnabled ? "bg-[var(--success)]" : "bg-[var(--secondary)]"}`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {account.provider === "codex"
                        ? <CodexQuotaCell codex={account.metadata?.codex_quota} fallbackRemaining={account.quotaRemaining} fallbackLimit={account.quotaLimit} />
                        : <CreditBar remaining={Number(account.quotaRemaining || 0)} total={Number(account.quotaLimit || 0)} />
                      }
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {timeAgo(account.lastLoginAt || account.lastUsedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5 justify-end">
                        {(account.provider.startsWith("kiro") || account.provider === "qoder") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenPanel(account.id)} title="Open Panel">
                            <ExternalLink className="w-3.5 h-3.5 text-[var(--info)]" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleWarmup(account.id)} title="WarmUp">
                          <RefreshCw className="w-3.5 h-3.5 text-[var(--warning)]" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleLogin(account.id)} title="Re-login" disabled={account.status !== "pending" && account.status !== "error"}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(account.id)} title="Delete">
                          <Trash2 className="w-3.5 h-3.5 text-[var(--error)]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-sm text-[var(--muted-foreground)]">No accounts found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > perPage && (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
              <p className="text-xs text-[var(--muted-foreground)]">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                <span className="text-xs text-[var(--muted-foreground)]">{page}/{Math.ceil(filtered.length / perPage)}</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= Math.ceil(filtered.length / perPage)} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

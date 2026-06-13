import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Activity, X, Copy, Check, Clock, Zap, Loader2 } from "lucide-react";
import { fetchRequests, fetchApi } from "@/lib/api";
import { useWsEvent } from "@/hooks/useWebSocket";

interface RequestLog {
  id: number;
  createdAt: string;
  provider: string;
  model: string | null;
  status: "success" | "error";
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  creditsUsed?: number | null;
  accountId: number | null;
  accountEmail?: string | null;
  accountQuotaBefore?: number | null;
  accountQuotaAfter?: number | null;
  errorMessage: string | null;
  requestBody?: unknown;
  responseBody?: unknown;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function labelProvider(provider: string) {
  return provider === "codebuddy" ? "CodeBuddy" : provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function Requests() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RequestLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 25;

  async function load() {
    setLoading(true);
    try {
      const res = await fetchRequests(1, 50, provider) as { data: RequestLog[] };
      const fetched = res.data || [];
      setLogs((current) => {
        const seen = new Map(fetched.map((r) => [r.id, r]));
        for (const r of current) { if (!seen.has(r.id)) seen.set(r.id, r); }
        return Array.from(seen.values());
      });
    } catch { /* keep existing logs */ }
    finally { setLoading(false); }
  }

  async function loadDetail(req: RequestLog) {
    setSelected(req);
    setDetailLoading(true);
    try {
      const res = await fetchApi<{ data: RequestLog }>(`/api/stats/requests/${req.id}`);
      if (res.data) setSelected(res.data);
    } catch { /* keep partial data */ }
    finally { setDetailLoading(false); }
  }

  useEffect(() => { load(); setPage(1); }, [provider]);
  useEffect(() => { setPage(1); }, [search]);

  useWsEvent(["request_log"], (msg) => {
    if (msg.type === "request_log") {
      setLogs((current) => [msg.data as RequestLog, ...current].slice(0, 100));
    }
  });

  const filtered = logs.filter((req) => {
    const q = search.toLowerCase();
    return req.model?.toLowerCase().includes(q) || req.provider.toLowerCase().includes(q) || req.errorMessage?.toLowerCase().includes(q) || String(req.accountId || "").includes(q);
  });

  const successCount = logs.filter((r) => r.status === "success").length;
  const errorCount = logs.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--chart-3)]/20 to-[var(--primary)]/10 border border-[var(--chart-3)]/20">
            <Activity className="w-5 h-5 text-[var(--chart-3)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Requests</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Recent API request logs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)]">{successCount} ok</span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--error)]/10 text-[var(--error)]">{errorCount} err</span>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search model, provider, error..." className="pl-9 h-9 text-sm" />
        </div>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)]">
          <option value="all">All Providers</option>
          <option value="kiro">Kiro</option>
          <option value="kiro-pro">Kiro Pro</option>
          <option value="codebuddy">CodeBuddy</option>
          <option value="codex">Codex</option>
          <option value="qoder">Qoder</option>
          <option value="canva">Canva</option>
        </select>
      </div>

      {/* Table */}
      <Card className="border-[var(--border)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/30">
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3">Model</th>
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 hidden md:table-cell">Provider</th>
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 hidden md:table-cell">Duration</th>
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Tokens</th>
                  <th className="text-left text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Credits</th>
                  <th className="text-right text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * perPage, page * perPage).map((req) => (
                  <tr key={req.id} onClick={() => loadDetail(req)} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--secondary)]/30 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        req.status === "success" ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--error)]/10 text-[var(--error)]"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${req.status === "success" ? "bg-[var(--success)]" : "bg-[var(--error)]"}`} />
                        {req.status === "success" ? "200" : "err"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-[var(--foreground)]">{req.model || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className="text-xs text-[var(--muted-foreground)] capitalize">{req.provider}</span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className={`text-xs tabular-nums ${
                        (req.durationMs || 0) < 5000 ? "text-[var(--foreground)]" : "text-[var(--warning)]"
                      }`}>
                        {req.durationMs ? `${(req.durationMs / 1000).toFixed(1)}s` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <span className="text-xs text-[var(--muted-foreground)] tabular-nums">{req.totalTokens ? req.totalTokens.toLocaleString() : "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <span className="text-xs text-[var(--muted-foreground)] tabular-nums">{req.creditsUsed ? Number(req.creditsUsed).toFixed(2) : "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[11px] text-[var(--muted-foreground)]">{timeAgo(req.createdAt)}</span>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-sm text-[var(--muted-foreground)]">No request logs</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > perPage && (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5">
              <p className="text-[11px] text-[var(--muted-foreground)]">{(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}</p>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2.5 py-1 rounded-md text-xs border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-40 transition-all">Prev</button>
                <span className="text-[11px] text-[var(--muted-foreground)]">{page}/{Math.ceil(filtered.length / perPage)}</span>
                <button disabled={page >= Math.ceil(filtered.length / perPage)} onClick={() => setPage(page + 1)} className="px-2.5 py-1 rounded-md text-xs border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] disabled:opacity-40 transition-all">Next</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-[480px] overflow-y-auto border-l border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--foreground)] font-mono">{selected.model || "Request"}</h2>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{timeAgo(selected.createdAt)} · {labelProvider(selected.provider)}</p>
              </div>
              <button className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors" onClick={() => setSelected(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-2 mt-4">
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                selected.status === "success" ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--error)]/10 text-[var(--error)]"
              }`}>
                <span className={`w-2 h-2 rounded-full ${selected.status === "success" ? "bg-[var(--success)]" : "bg-[var(--error)]"}`} />
                {selected.status === "success" ? "Success" : "Error"}
              </span>
              {selected.durationMs && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <Clock className="w-3 h-3" /> {(selected.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="rounded-lg bg-[var(--info)]/10 p-2.5 text-center">
                <p className="text-[9px] uppercase text-[var(--info)] font-medium">Total</p>
                <p className="text-sm font-bold text-[var(--info)]">{(selected.totalTokens || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-[var(--success)]/10 p-2.5 text-center">
                <p className="text-[9px] uppercase text-[var(--success)] font-medium">Prompt</p>
                <p className="text-sm font-bold text-[var(--success)]">{(selected.promptTokens || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-[var(--chart-3)]/10 p-2.5 text-center">
                <p className="text-[9px] uppercase text-[var(--chart-3)] font-medium">Compl.</p>
                <p className="text-sm font-bold text-[var(--chart-3)]">{(selected.completionTokens || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-[var(--warning)]/10 p-2.5 text-center">
                <p className="text-[9px] uppercase text-[var(--warning)] font-medium">Credits</p>
                <p className="text-sm font-bold text-[var(--warning)]">{Number(selected.creditsUsed || 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Account */}
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20 p-3">
              <p className="text-[10px] uppercase text-[var(--muted-foreground)] font-medium mb-1">Account</p>
              <p className="text-xs font-medium text-[var(--foreground)]">{selected.accountEmail || `#${selected.accountId || "—"}`}</p>
              {(selected.accountQuotaBefore != null || selected.accountQuotaAfter != null) && (
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  Quota: {selected.accountQuotaBefore ?? "?"} → {selected.accountQuotaAfter ?? "?"}
                </p>
              )}
            </div>

            {/* Error */}
            {selected.errorMessage && (
              <div className="mt-4 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/20 p-3 text-xs text-[var(--error)]">
                {selected.errorMessage}
              </div>
            )}

            {/* JSON blocks */}
            {detailLoading ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading details...
              </div>
            ) : (
              <>
                <JsonBlock title="Request Body" value={selected.requestBody} />
                <JsonBlock title="Response Body" value={selected.responseBody} />
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value || {}, null, 2);
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] uppercase text-[var(--muted-foreground)] font-medium">{title}</p>
        <button
          className="inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-60 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[10px] font-mono text-[var(--muted-foreground)] leading-relaxed">{text}</pre>
    </div>
  );
}

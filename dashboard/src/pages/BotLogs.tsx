import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { clearAuthLogs, fetchAuthLogs, fetchAuthQueue, fetchWarmupQueue, loginAccount, loginAccounts, stopAllAccounts } from "@/lib/api";
import { useWsEvent, useWsStatus } from "@/hooks/useWebSocket";
import { AlertTriangle, CheckCircle, ChevronDown, RefreshCw, RotateCcw, Trash2, Radio, StopCircle, Bot, Wifi } from "lucide-react";
import { formatTimeID } from "@/lib/utils";

interface AuthLog {
  id: number;
  timestamp: string;
  type: string;
  accountId?: number;
  email?: string;
  provider?: string;
  step?: string;
  message?: string;
  error?: string;
  data?: unknown;
}

interface ProcessLog {
  key: string;
  operation: string;
  latest: AuthLog;
  events: AuthLog[];
  startedAt: string;
  updatedAt: string;
}

const liveTypes: string[] = [
  "queue_added", "queue_processing", "login_progress", "login_success", "login_failed", "queue_complete", "queue_cleared",
];

function statusVariant(type: string): "success" | "warning" | "error" | "secondary" {
  if (type.includes("success") || type === "queue_complete") return "success";
  if (type.includes("failed") || type.includes("auth_error")) return "error";
  if (type.includes("processing") || type.includes("progress")) return "warning";
  return "secondary";
}

function processStatusVariant(process: ProcessLog): "success" | "warning" | "error" | "secondary" {
  if (process.events.some((log) => log.type === "login_success")) return "success";
  if (process.events.some((log) => log.type === "login_failed")) return "error";
  return statusVariant(process.latest.type);
}

function processStatusLabel(process: ProcessLog) {
  if (process.events.some((log) => log.type === "login_success")) return "success";
  if (process.events.some((log) => log.type === "login_failed")) return "error";
  return process.latest.type.replace(/^login_/, "").replace(/^queue_/, "").replace(/_/g, " ");
}

function providerLabel(provider?: string) {
  if (!provider) return "-";
  return provider === "codebuddy" ? "CodeBuddy" : provider.charAt(0).toUpperCase() + provider.slice(1);
}

function operationFor(type: string) {
  return type.startsWith("warmup_") ? "WarmUp" : "Login";
}

function processKey(log: AuthLog) {
  const account = log.accountId || log.email || log.id;
  return `${operationFor(log.type)}-${account}`;
}

function mergeLogs(current: AuthLog[], incoming: AuthLog[]) {
  const map = new Map<string, AuthLog>();
  for (const log of [...current, ...incoming]) {
    const key = `${log.id}-${log.timestamp}-${log.type}-${log.accountId || ""}-${log.step || ""}`;
    map.set(key, log);
  }
  return [...map.values()].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function logsToProcesses(logs: AuthLog[]): ProcessLog[] {
  const groups = new Map<string, ProcessLog>();
  const oldestFirst = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  for (const log of oldestFirst) {
    const key = processKey(log);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { key, operation: operationFor(log.type), latest: log, events: [log], startedAt: log.timestamp, updatedAt: log.timestamp });
      continue;
    }
    existing.events.push(log);
    existing.latest = { ...log, email: log.email || existing.latest.email, provider: log.provider || existing.latest.provider };
    existing.updatedAt = log.timestamp;
  }
  return [...groups.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export default function BotLogs() {
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [queue, setQueue] = useState<any>(null);
  const [warmupQueue, setWarmupQueue] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 25;
  const queueRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsStatus = useWsStatus();
  const connected = wsStatus === "open";

  async function load() {
    const [logRes, queueRes] = await Promise.all([
      fetchAuthLogs(300) as Promise<{ data: AuthLog[] }>,
      fetchAuthQueue().catch(() => null),
    ]);
    setLogs((current) => mergeLogs(current, (logRes.data || []).filter((log) => !log.type.startsWith("warmup_"))));
    setQueue(queueRes);
  }

  const refreshQueues = useCallback(async () => {
    const queueRes = await fetchAuthQueue().catch(() => null);
    setQueue(queueRes);
  }, []);

  const scheduleQueueRefresh = useCallback(() => {
    if (queueRefreshTimerRef.current) return;
    queueRefreshTimerRef.current = setTimeout(() => { queueRefreshTimerRef.current = null; refreshQueues(); }, 300);
  }, [refreshQueues]);

  useEffect(() => {
    load().catch(() => {});
    return () => { if (queueRefreshTimerRef.current) clearTimeout(queueRefreshTimerRef.current); };
  }, []);

  useWsEvent(liveTypes, (msg) => {
    if (msg.type === "queue_complete") setQueue((c: any) => ({ ...(c || {}), ...(msg.data || {}), queued: 0, active: 0 }));
    if (msg.type === "queue_cleared") setQueue((c: any) => ({ ...(c || {}), queued: 0, active: 0 }));
    const data = msg.data || {};
    const log: AuthLog = { id: data.logId || data.id || Date.now(), timestamp: data.timestamp || new Date().toISOString(), type: msg.type, accountId: data.accountId || data.id, email: data.email, provider: data.provider, step: data.step, message: data.message || data.error || msg.type, error: data.error, data };
    setLogs((current) => mergeLogs(current, [log]));
    scheduleQueueRefresh();
  });

  const failed = useMemo(() => logs.filter((log) => log.type === "login_failed"), [logs]);
  const failedAccounts = useMemo(() => {
    const map = new Map<string, AuthLog>();
    for (const log of failed) {
      const key = `${log.accountId || log.email || log.id}-${log.provider || "unknown"}`;
      if (!map.has(key) || new Date(log.timestamp).getTime() > new Date(map.get(key)!.timestamp).getTime()) map.set(key, log);
    }
    return [...map.values()];
  }, [failed]);

  const processes = useMemo(() => logsToProcesses(logs).filter((p) => !(p.events.length === 1 && (p.events[0].type === "queue_added" || p.events[0].type === "warmup_queue_added"))), [logs]);

  const running = Number(queue?.active || 0);
  const queued = Number(queue?.queued || 0);
  const totalSuccess = Number(queue?.totalSuccess || 0);
  const totalFailed = Number(queue?.totalFailed || 0);

  async function handleClear() { await clearAuthLogs(); setLogs([]); }
  async function handleStopAll() { await stopAllAccounts(); await load().catch(() => {}); }
  async function handleRetry(accountId?: number) { if (!accountId) return; await loginAccount(accountId); await load().catch(() => {}); }
  async function handleRetryAll() {
    const ids = Array.from(new Set(failedAccounts.map((l) => l.accountId).filter((id): id is number => Boolean(id))));
    if (ids.length === 0) return;
    await loginAccounts(ids);
    await load().catch(() => {});
  }

  const statusColors: Record<string, string> = { success: "bg-[var(--success)]", error: "bg-[var(--error)]", warning: "bg-[var(--warning)]", secondary: "bg-[var(--muted-foreground)]" };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-[var(--error)]/10 border border-amber-500/20">
            <Bot className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Login Logs</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Live login bot progress</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${connected ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--muted)]/10 text-[var(--muted-foreground)]"}`}>
            <Wifi className="w-3 h-3" /> {connected ? "Live" : "Offline"}
          </span>
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={handleStopAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20 hover:bg-[var(--error)]/20 transition-all">
            <StopCircle className="w-3.5 h-3.5" /> Stop
          </button>
          <button onClick={handleClear} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-all">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--foreground)]">{queued}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Queued</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--warning)]">{running}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Running</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--success)]">{totalSuccess}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Success</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--error)]">{totalFailed}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Failed</p>
        </div>
      </div>

      {/* Running indicator */}
      {(running > 0 || queued > 0) && (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-4 py-2.5 text-xs text-[var(--warning)] flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          {running} processing, {queued} queued — logs update in real-time
        </div>
      )}

      {/* Failed accounts */}
      {failedAccounts.length > 0 && (
        <Card className="border-[var(--error)]/20 bg-[var(--error)]/[0.02]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--error)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {failedAccounts.length} Failed
              </span>
              <button onClick={handleRetryAll} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-all">
                <RotateCcw className="w-3 h-3" /> Retry All
              </button>
            </div>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {failedAccounts.map((log) => (
                <div key={`f-${log.accountId || log.id}-${log.provider}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)]/50 text-xs">
                  <span className="font-medium text-[var(--foreground)] truncate flex-1">{log.email || `#${log.accountId}`}</span>
                  <span className="text-[var(--muted-foreground)] shrink-0">{providerLabel(log.provider)}</span>
                  <button onClick={() => handleRetry(log.accountId)} disabled={!log.accountId} className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-30">
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process list */}
      <Card className="border-[var(--border)]">
        <CardContent className="p-0">
          {processes.length === 0 ? (
            <div className="p-8 text-center">
              <Bot className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-2" />
              <p className="text-sm text-[var(--muted-foreground)]">No login logs yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {processes.slice((page - 1) * perPage, page * perPage).map((process) => {
                const variant = processStatusVariant(process);
                return (
                  <Fragment key={process.key}>
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--secondary)]/30 transition-colors flex items-center gap-3"
                      onClick={() => setExpanded((c) => c === process.key ? null : process.key)}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusColors[variant]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--foreground)] truncate">{process.latest.email || `#${process.latest.accountId || "?"}`}</span>
                          <span className="text-[10px] text-[var(--muted-foreground)]">{providerLabel(process.latest.provider)}</span>
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">{process.latest.error || process.latest.message || process.latest.step || "-"}</p>
                      </div>
                      <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">{timeAgo(process.updatedAt)}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 w-8 text-right">{process.events.length}×</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0 transition-transform ${expanded === process.key ? "rotate-180" : ""}`} />
                    </button>
                    {expanded === process.key && (
                      <div className="px-4 py-3 bg-[var(--secondary)]/20 border-t border-[var(--border)]/50">
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                          {process.events.map((log) => (
                            <div key={`${log.id}-${log.timestamp}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--card)] border border-[var(--border)]/50 text-[11px]">
                              <span className="font-mono text-[var(--muted-foreground)] shrink-0 w-14">{formatTimeID(log.timestamp)}</span>
                              <span className="text-[var(--muted-foreground)] shrink-0 w-20 truncate">{log.step || log.type.replace(/^login_/, "").replace(/^queue_/, "")}</span>
                              <span className={`truncate flex-1 ${log.error ? "text-[var(--error)]" : "text-[var(--foreground)]"}`}>{log.error || log.message || "-"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
          {processes.length > perPage && (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5">
              <p className="text-[11px] text-[var(--muted-foreground)]">{(page - 1) * perPage + 1}–{Math.min(page * perPage, processes.length)} of {processes.length}</p>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2.5 py-1 rounded-md text-xs border border-[var(--border)] hover:bg-[var(--secondary)] disabled:opacity-40 transition-all">Prev</button>
                <span className="text-[11px] text-[var(--muted-foreground)]">{page}/{Math.ceil(processes.length / perPage)}</span>
                <button disabled={page >= Math.ceil(processes.length / perPage)} onClick={() => setPage(page + 1)} className="px-2.5 py-1 rounded-md text-xs border border-[var(--border)] hover:bg-[var(--secondary)] disabled:opacity-40 transition-all">Next</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

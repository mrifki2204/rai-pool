import { useEffect, useRef, useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatsCards from "@/components/dashboard/StatsCards";
import TokenUsage from "@/components/dashboard/TokenUsage";
import ProviderStatus, { type ProviderInfo } from "@/components/dashboard/ProviderStatus";
import RecentRequests, { type RequestLog } from "@/components/dashboard/RecentRequests";
import ModelBreakdown, { type ModelUsageItem } from "@/components/dashboard/ModelBreakdown";
import { fetchDashboardStats, fetchProviders, fetchRequests } from "@/lib/api";
import { useWsEvent } from "@/hooks/useWebSocket";

export default function Dashboard() {
  const [period, setPeriod] = useState("1d");
  const [stats, setStats] = useState<any>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [recentRequests, setRecentRequests] = useState<RequestLog[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsageItem[]>([]);

  // Fetch dashboard stats
  async function loadStats() {
    try {
      const hours = period === "1d" ? 24 : period === "7d" ? 168 : period === "30d" ? 720 : null;
      const range = period === "all" ? "all" : undefined;
      const res = await fetchDashboardStats(hours, range);
      setStats(res);
    } catch {
      setStats(null);
    }
  }

  // Fetch provider data
  async function loadProviders() {
    try {
      const res = await fetchProviders() as { data: any[] };
      const mapped: ProviderInfo[] = (res.data || []).map((p: any) => ({
        provider: p.provider || "unknown",
        activeAccounts: Number(p.activeAccounts || 0),
        totalAccounts: Number(p.totalAccounts || 0),
        exhaustedAccounts: Number(p.exhaustedAccounts || 0),
        errorAccounts: Number(p.errorAccounts || 0),
        disabledAccounts: Number(p.disabledAccounts || 0),
        quotaLimit: Number(p.quotaLimit || 0),
        quotaRemaining: Number(p.quotaRemaining || 0),
        totalRequests: Number(p.totalRequests || 0),
        totalTokens: Number(p.totalTokens || 0),
      }));
      setProviders(mapped);
    } catch {
      setProviders([]);
    }
  }

  // Fetch recent requests
  async function loadRecentRequests() {
    try {
      const res = await fetchRequests(1, 7) as { data: any[] };
      const mapped: RequestLog[] = (res.data || []).map((r: any) => ({
        id: r.id,
        model: r.model || "unknown",
        provider: r.provider || "unknown",
        status: r.status === "success" ? 200 : r.status === "error" ? 500 : 0,
        durationMs: r.durationMs ? Number(r.durationMs) : null,
        totalTokens: r.totalTokens ? Number(r.totalTokens) : null,
        promptTokens: r.promptTokens ? Number(r.promptTokens) : null,
        completionTokens: r.completionTokens ? Number(r.completionTokens) : null,
        error: r.error || null,
        createdAt: r.createdAt || "",
      }));
      setRecentRequests(mapped);
    } catch {
      setRecentRequests([]);
    }
  }

  // Load all data
  async function loadAll() {
    await Promise.all([loadStats(), loadProviders(), loadRecentRequests()]);
  }

  // Debounced reload
  const reloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadRef.current) clearTimeout(reloadRef.current);
    reloadRef.current = setTimeout(() => { loadAll(); }, 500);
  }, [period]);

  useEffect(() => {
    loadAll();
    return () => { if (reloadRef.current) clearTimeout(reloadRef.current); };
  }, [period]);

  // Real-time updates
  useWsEvent(
    [
      "request_log",
      "request_error",
      "account_status",
      "account_updated",
      "account_created",
      "account_deleted",
      "accounts_updated",
      "accounts_bulk_created",
      "provider_toggled",
    ],
    scheduleReload,
  );

  // Compute stats for StatsCards
  const totalRequests = Number(stats?.requests?.total || 0);
  const successRequests = Number(stats?.requests?.success || 0);
  const errorRequests = Number(stats?.requests?.errors || 0);
  const totalAccounts = Number(stats?.pool?.total || 0);
  const activeAccounts = Number(stats?.pool?.active || 0);
  const exhaustedAccounts = Number(stats?.pool?.exhausted || 0);
  const errorAccounts = Number(stats?.pool?.error || 0);

  const dashboardStats = {
    accounts: {
      active: activeAccounts,
      total: totalAccounts,
      exhausted: exhaustedAccounts,
      error: errorAccounts,
    },
    requests: {
      total: totalRequests,
      success: successRequests,
      errors: errorRequests,
    },
    successRate: totalRequests > 0 ? Number(((successRequests / totalRequests) * 100).toFixed(1)) : 0,
    totalTokens: Number(stats?.tokens?.total || 0),
    avgLatency: Number(stats?.performance?.avgDurationMs || 0),
    credits: Number(stats?.tokens?.credits || 0),
  };

  // Callbacks from TokenUsage
  const handleModelUsageUpdate = useCallback((models: any[]) => {
    setModelUsage(models.map((m) => ({
      provider: m.provider || "unknown",
      model: m.model || "unknown",
      tokens: Number(m.tokens || 0),
      promptTokens: Number(m.promptTokens || 0),
      completionTokens: Number(m.completionTokens || 0),
      credits: Number(m.credits || 0),
      requests: Number(m.requests || 0),
      color: m.color || "#6b7280",
    })));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Overview of your proxy pool status
          </p>
        </div>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="1d">24h</TabsTrigger>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Cards - 5 columns */}
      <StatsCards data={dashboardStats} />

      {/* Middle row: Chart + Provider Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TokenUsage
            period={period}
            onModelUsageUpdate={handleModelUsageUpdate}
          />
        </div>
        <div className="lg:col-span-1">
          <ProviderStatus providers={providers} />
        </div>
      </div>

      {/* Bottom row: Recent Requests + Model Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentRequests requests={recentRequests} />
        <ModelBreakdown models={modelUsage} />
      </div>
    </div>
  );
}

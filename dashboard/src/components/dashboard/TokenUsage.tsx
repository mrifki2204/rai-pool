import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UsageChart from "./UsageChart";
import { formatNumber, parseUtcDate, modelColor } from "@/lib/utils";
import { fetchUsage } from "@/lib/api";
import { useWsEvent } from "@/hooks/useWebSocket";
import { BarChart3 } from "lucide-react";

interface TokenStats {
  total: number;
  prompt: number;
  completion: number;
  credits?: number;
}

interface ModelUsage {
  provider?: string;
  model: string;
  tokens: number;
  promptTokens?: number;
  completionTokens?: number;
  credits?: number;
  requests?: number;
  creditSource?: string;
  color: string;
}

interface TokenUsageProps {
  period: string;
  onStatsUpdate?: (stats: TokenStats) => void;
  onModelUsageUpdate?: (models: ModelUsage[]) => void;
}

/**
 * How many hours of data to request from the backend.
 */
function getChartHours(period: string): number | null {
  if (period === "1d") return 48;
  if (period === "7d") return 24 * 8;
  if (period === "30d") return 24 * 31;
  return null; // "all"
}

function modelKey(row: { provider?: string; model?: string }) {
  return `${row.provider || "unknown"}/${row.model || "unknown"}`;
}

// ─── Local-timezone bucket helpers ──────────────────────────────────────────

function truncHourLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
}

function truncDayLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function truncMonthLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function snapToLocalBucket(utcEpoch: number, period: string): number {
  const d = new Date(utcEpoch);
  if (period === "1d") return truncHourLocal(d);
  if (period === "7d" || period === "30d") return truncDayLocal(d);
  return truncMonthLocal(d);
}

function parseBucketKey(isoKey: string): number {
  return parseUtcDate(isoKey).getTime();
}

function formatLabel(epoch: number, period: string): string {
  const d = new Date(epoch);
  if (period === "1d") {
    return `${String(d.getHours()).padStart(2, "0")}:00`;
  }
  if (period === "7d" || period === "30d") {
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function generateBuckets(period: string): number[] {
  const now = new Date();
  const buckets: number[] = [];

  if (period === "1d") {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    for (let i = 0; i <= 24; i++) {
      buckets.push(todayStart + i * 3600_000);
    }
    return buckets;
  }

  if (period === "7d" || period === "30d") {
    const days = period === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      buckets.push(d.getTime());
    }
    return buckets;
  }

  // "all" — last 12 months
  for (let i = 11; i >= 0; i--) {
    buckets.push(new Date(now.getFullYear(), now.getMonth() - i, 1).getTime());
  }
  return buckets;
}

interface UsageRow {
  hour: string;
  provider?: string;
  model?: string;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  credits?: number;
  count?: number;
}

function processUsageData(rows: UsageRow[], period: string) {
  const bucketEpochs = generateBuckets(period);
  const bucketSet = new Set(bucketEpochs);

  const visibleRows: Array<UsageRow & { localEpoch: number }> = [];
  for (const row of rows) {
    const utcEpoch = parseBucketKey(row.hour);
    const localEpoch = snapToLocalBucket(utcEpoch, period);
    if (bucketSet.has(localEpoch)) {
      visibleRows.push({ ...row, localEpoch });
    }
  }

  const models = Array.from(new Set(visibleRows.map(modelKey)));
  const byEpoch = new Map<number, Record<string, number | string>>();
  for (const epoch of bucketEpochs) {
    const entry: Record<string, number | string> = {
      hour: String(epoch),
      label: formatLabel(epoch, period),
    };
    for (const model of models) entry[model] = 0;
    byEpoch.set(epoch, entry);
  }
  for (const row of visibleRows) {
    const model = modelKey(row);
    const bucket = byEpoch.get(row.localEpoch)!;
    bucket[model] = Number(bucket[model] || 0) + Number(row.tokens || 0);
  }
  const chartData = bucketEpochs.map((epoch) => byEpoch.get(epoch)!);

  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let credits = 0;
  for (const row of visibleRows) {
    totalTokens += Number(row.tokens || 0);
    promptTokens += Number(row.promptTokens || 0);
    completionTokens += Number(row.completionTokens || 0);
    credits += Number(row.credits || 0);
  }
  const stats: TokenStats = { total: totalTokens, prompt: promptTokens, completion: completionTokens, credits };

  const modelMap = new Map<string, {
    provider: string;
    model: string;
    tokens: number;
    promptTokens: number;
    completionTokens: number;
    credits: number;
    requests: number;
  }>();
  for (const row of visibleRows) {
    const key = modelKey(row);
    const existing = modelMap.get(key);
    if (existing) {
      existing.tokens += Number(row.tokens || 0);
      existing.promptTokens += Number(row.promptTokens || 0);
      existing.completionTokens += Number(row.completionTokens || 0);
      existing.credits += Number(row.credits || 0);
      existing.requests += Number(row.count || 0);
    } else {
      modelMap.set(key, {
        provider: row.provider || "unknown",
        model: row.model || "unknown",
        tokens: Number(row.tokens || 0),
        promptTokens: Number(row.promptTokens || 0),
        completionTokens: Number(row.completionTokens || 0),
        credits: Number(row.credits || 0),
        requests: Number(row.count || 0),
      });
    }
  }
  const modelUsage: ModelUsage[] = Array.from(modelMap.values())
    .filter((m) => m.tokens > 0 || m.credits > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8)
    .map((m, idx) => ({
      ...m,
      creditSource: "estimated",
      color: modelColor(`${m.provider}/${m.model}`, idx),
    }));

  return { chartData, stats, modelUsage };
}

export default function TokenUsage({ period, onStatsUpdate, onModelUsageUpdate }: TokenUsageProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [colorsByModel, setColorsByModel] = useState<Record<string, string>>({});

  const reloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadData() {
    const hours = getChartHours(period);
    const range = period === "all" ? "all" : undefined;
    try {
      const usageRes = await fetchUsage(hours, range) as { data: UsageRow[] };
      const { chartData: chart, stats, modelUsage } = processUsageData(usageRes.data || [], period);
      setChartData(chart);
      setColorsByModel(
        Object.fromEntries(modelUsage.map((m) => [`${m.provider || "unknown"}/${m.model || "unknown"}`, m.color]))
      );
      onStatsUpdate?.(stats);
      onModelUsageUpdate?.(modelUsage as any);
    } catch {
      setChartData([]);
      setColorsByModel({});
    }
  }

  const scheduleReload = () => {
    if (reloadRef.current) clearTimeout(reloadRef.current);
    reloadRef.current = setTimeout(() => { loadData(); }, 500);
  };

  useEffect(() => {
    loadData();
    return () => { if (reloadRef.current) clearTimeout(reloadRef.current); };
  }, [period]);

  useWsEvent(["request_log", "request_error"], scheduleReload);

  return (
    <Card className="border-[var(--border)] h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--muted-foreground)]" />
          Token Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <UsageChart data={chartData} period={period} colorsByModel={colorsByModel} />
      </CardContent>
    </Card>
  );
}

import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TokenUsage from "@/components/dashboard/TokenUsage";
import ModelBreakdown, { type ModelUsageItem } from "@/components/dashboard/ModelBreakdown";
import { formatNumber } from "@/lib/utils";
import { BarChart3, Zap, MessageSquare, Sparkles } from "lucide-react";

interface TokenStats {
  total: number;
  prompt: number;
  completion: number;
  credits?: number;
}

export default function Usage() {
  const [period, setPeriod] = useState("7d");
  const [stats, setStats] = useState<TokenStats>({ total: 0, prompt: 0, completion: 0, credits: 0 });
  const [modelUsage, setModelUsage] = useState<ModelUsageItem[]>([]);

  const handleStatsUpdate = useCallback((s: TokenStats) => { setStats(s); }, []);
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--chart-3)]/20 to-[var(--primary)]/10 border border-[var(--chart-3)]/20">
            <BarChart3 className="w-5 h-5 text-[var(--chart-3)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Usage</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Token and credit usage analytics</p>
          </div>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--info)]/10">
            <Zap className="w-4 h-4 text-[var(--info)]" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Total Tokens</p>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">{formatNumber(stats.total)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--success)]/10">
            <MessageSquare className="w-4 h-4 text-[var(--success)]" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Prompt</p>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">{formatNumber(stats.prompt)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--chart-3)]/10">
            <Sparkles className="w-4 h-4 text-[var(--chart-3)]" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Completion</p>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">{formatNumber(stats.completion)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--warning)]/10">
            <Zap className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Credits</p>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">{(stats.credits || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <TokenUsage
        period={period}
        onStatsUpdate={handleStatsUpdate}
        onModelUsageUpdate={handleModelUsageUpdate}
      />

      {/* Model breakdown */}
      <ModelBreakdown models={modelUsage} />
    </div>
  );
}

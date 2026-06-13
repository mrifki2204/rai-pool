import { Users, Activity, CheckCircle, Zap, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

interface StatsData {
  accounts: { active: number; total: number; exhausted?: number; error?: number };
  requests: { total: number; success: number; errors: number };
  successRate: number;
  totalTokens: number;
  avgLatency: number;
  credits: number;
}

interface StatsCardsProps {
  data?: StatsData;
}

const defaultData: StatsData = {
  accounts: { active: 0, total: 0, exhausted: 0, error: 0 },
  requests: { total: 0, success: 0, errors: 0 },
  successRate: 0,
  totalTokens: 0,
  avgLatency: 0,
  credits: 0,
};

export default function StatsCards({ data = defaultData }: StatsCardsProps) {
  const successRateColor = data.successRate >= 95
    ? "text-[var(--success)]"
    : data.successRate >= 80
      ? "text-[var(--warning)]"
      : "text-[var(--error)]";

  const stats = [
    {
      label: "Active Accounts",
      value: `${data.accounts.active}/${data.accounts.total}`,
      subtitle: data.accounts.exhausted
        ? `${data.accounts.exhausted} exhausted`
        : data.accounts.error
          ? `${data.accounts.error} error`
          : "all healthy",
      icon: Users,
      color: "text-[var(--chart-2)]",
      bgColor: "bg-[var(--chart-2)]/10",
    },
    {
      label: "Requests",
      value: data.requests.total.toLocaleString(),
      subtitle: data.requests.errors > 0
        ? `${data.requests.errors} failed`
        : "no errors",
      icon: Activity,
      color: "text-[var(--chart-3)]",
      bgColor: "bg-[var(--chart-3)]/10",
    },
    {
      label: "Success Rate",
      value: `${data.successRate}%`,
      subtitle: data.requests.total > 0
        ? `${data.requests.success.toLocaleString()} successful`
        : "no requests yet",
      icon: CheckCircle,
      color: successRateColor,
      bgColor: data.successRate >= 95
        ? "bg-[var(--success)]/10"
        : data.successRate >= 80
          ? "bg-[var(--warning)]/10"
          : "bg-[var(--error)]/10",
    },
    {
      label: "Avg Latency",
      value: data.avgLatency > 0 ? formatDuration(data.avgLatency) : "—",
      subtitle: data.avgLatency > 0
        ? data.avgLatency < 2000
          ? "fast"
          : data.avgLatency < 5000
            ? "moderate"
            : "slow"
        : "no data",
      icon: Clock,
      color: "text-[var(--chart-6)]",
      bgColor: "bg-[var(--chart-6)]/10",
    },
    {
      label: "Total Tokens",
      value: formatTokens(data.totalTokens),
      subtitle: data.credits > 0
        ? `${data.credits.toFixed(1)} credits`
        : "all time",
      icon: Zap,
      color: "text-[var(--warning)]",
      bgColor: "bg-[var(--warning)]/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="group relative overflow-hidden transition-all hover:border-[var(--primary)]/40 hover:shadow-[var(--shadow-card)]"
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wide font-medium">
                  {stat.label}
                </p>
                <p className="text-xl font-bold mt-1.5 text-[var(--foreground)] tabular-nums leading-tight">
                  {stat.value}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 truncate">
                  {stat.subtitle}
                </p>
              </div>
              <div className={`p-2.5 rounded-lg ${stat.bgColor} transition-transform group-hover:scale-110 shrink-0 ml-2`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

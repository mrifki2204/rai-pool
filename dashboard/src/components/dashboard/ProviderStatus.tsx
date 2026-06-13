import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server } from "lucide-react";

export interface ProviderInfo {
  provider: string;
  activeAccounts: number;
  totalAccounts: number;
  exhaustedAccounts: number;
  errorAccounts: number;
  disabledAccounts: number;
  quotaLimit: number;
  quotaRemaining: number;
  totalRequests: number;
  totalTokens: number;
}

interface ProviderStatusProps {
  providers: ProviderInfo[];
}

const providerColors: Record<string, string> = {
  kiro: "#38bdf8",
  "kiro-pro": "#818cf8",
  codebuddy: "#f472b6",
  codex: "#34d399",
  canva: "#a78bfa",
  qoder: "#fbbf24",
  byok: "#fb923c",
};

function getProviderColor(provider: string): string {
  return providerColors[provider.toLowerCase()] || "#6b7280";
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function ProviderStatus({ providers }: ProviderStatusProps) {
  if (providers.length === 0) {
    return (
      <Card className="border-[var(--border)] h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Server className="w-4 h-4 text-[var(--muted-foreground)]" />
            Provider Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted-foreground)]">
            No providers configured yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border)] h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--muted-foreground)]" />
          Provider Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {providers.map((p) => {
          const color = getProviderColor(p.provider);
          const quotaUsed = p.quotaLimit > 0 ? p.quotaLimit - p.quotaRemaining : 0;
          const quotaPercent = p.quotaLimit > 0
            ? Math.round((quotaUsed / p.quotaLimit) * 100)
            : 0;
          const isHealthy = p.activeAccounts > 0;
          const hasIssues = p.errorAccounts > 0 || p.exhaustedAccounts > 0;

          return (
            <div
              key={p.provider}
              className="rounded-lg border border-[var(--border)] p-3 transition-colors hover:border-[var(--primary)]/30"
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: isHealthy ? color : "var(--error)",
                      boxShadow: isHealthy ? `0 0 6px ${color}` : "0 0 6px var(--error)",
                    }}
                  />
                  <span className="text-sm font-medium text-[var(--foreground)] capitalize">
                    {p.provider}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.errorAccounts > 0 && (
                    <Badge variant="error" className="text-[10px] px-1.5 py-0">
                      {p.errorAccounts} err
                    </Badge>
                  )}
                  {p.exhaustedAccounts > 0 && (
                    <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                      {p.exhaustedAccounts} exh
                    </Badge>
                  )}
                  <span className="text-xs text-[var(--muted-foreground)] tabular-nums">
                    {p.activeAccounts}/{p.totalAccounts}
                  </span>
                </div>
              </div>

              {/* Quota bar */}
              {p.quotaLimit > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-[var(--secondary)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(quotaPercent, 100)}%`,
                        backgroundColor: quotaPercent > 90 ? "var(--error)" : quotaPercent > 70 ? "var(--warning)" : color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                    <span>{quotaPercent}% used</span>
                    <span>{formatNumber(p.quotaRemaining)} remaining</span>
                  </div>
                </div>
              )}

              {/* Stats row */}
              {p.quotaLimit === 0 && (
                <div className="flex gap-3 text-[10px] text-[var(--muted-foreground)]">
                  <span>{formatNumber(p.totalRequests)} req</span>
                  <span>{formatNumber(p.totalTokens)} tokens</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

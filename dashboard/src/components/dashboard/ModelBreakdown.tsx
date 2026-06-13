import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface ModelUsageItem {
  provider: string;
  model: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  credits: number;
  requests: number;
  color: string;
}

interface ModelBreakdownProps {
  models: ModelUsageItem[];
}

export default function ModelBreakdown({ models }: ModelBreakdownProps) {
  const maxTokens = Math.max(1, ...models.map((m) => m.tokens));
  const totalTokens = models.reduce((sum, m) => sum + m.tokens, 0);

  return (
    <Card className="border-[var(--border)] h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--muted-foreground)]" />
          Model Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
            No model usage yet
          </p>
        ) : (
          <div className="space-y-3">
            {models.map((model) => {
              const percentage = totalTokens > 0
                ? Math.round((model.tokens / totalTokens) * 100)
                : 0;

              return (
                <div key={`${model.provider}/${model.model}`} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: model.color }}
                      />
                      <span className="text-xs font-medium text-[var(--foreground)] truncate">
                        {model.model}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
                        {model.requests} req
                      </span>
                      <span className="text-[11px] font-medium text-[var(--foreground)] tabular-nums min-w-[40px] text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--secondary)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(model.tokens / maxTokens) * 100}%`,
                        backgroundColor: model.color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                    <span className="capitalize">{model.provider}</span>
                    <span className="tabular-nums">{formatNumber(model.tokens)} tokens</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

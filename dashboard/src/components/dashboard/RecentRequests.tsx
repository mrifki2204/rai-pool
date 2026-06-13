import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface RequestLog {
  id: number;
  model: string;
  provider: string;
  status: number;
  durationMs: number | null;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  error: string | null;
  createdAt: string;
}

interface RecentRequestsProps {
  requests: RequestLog[];
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return "—";
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatTokens(n: number | null): string {
  if (n === null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function getStatusVariant(status: number): "success" | "warning" | "error" | "secondary" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "error";
  return "secondary";
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`).getTime();
  const diff = now - then;

  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function RecentRequests({ requests }: RecentRequestsProps) {
  return (
    <Card className="border-[var(--border)] h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--muted-foreground)]" />
            Recent Requests
          </CardTitle>
          <Link
            to="/requests"
            className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80 flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
            No requests yet
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-md px-3 py-2 bg-[var(--secondary)]/50 hover:bg-[var(--secondary)] transition-colors"
              >
                {/* Status badge */}
                <Badge
                  variant={getStatusVariant(req.status)}
                  className="text-[10px] px-1.5 py-0 font-mono shrink-0 min-w-[36px] justify-center"
                >
                  {req.status}
                </Badge>

                {/* Model & provider */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">
                    {req.model}
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)] capitalize">
                    {req.provider}
                  </p>
                </div>

                {/* Duration */}
                <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums shrink-0">
                  {formatDuration(req.durationMs)}
                </span>

                {/* Tokens */}
                <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums shrink-0 min-w-[40px] text-right">
                  {formatTokens(req.totalTokens)}
                </span>

                {/* Time ago */}
                <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 min-w-[45px] text-right">
                  {timeAgo(req.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

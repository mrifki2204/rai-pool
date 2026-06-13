import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Cpu, Copy, Check, Search, Brain, MessageSquare, Eye, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchModels } from "@/lib/api";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import ProviderIcon from "@/components/dashboard/ProviderIcon";

interface ModelData {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  context_window?: number;
  max_output?: number;
  thinking?: boolean;
  vision?: boolean;
}

const providerColors: Record<string, string> = {
  kiro: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "kiro-pro": "bg-violet-500/15 text-violet-400 border-violet-500/30",
  codebuddy: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  canva: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  codex: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  qoder: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  byok: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function formatNumber(n: number | undefined): string {
  if (!n) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function formatContext(n: number | undefined): string {
  if (!n) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

export default function Models() {
  const [models, setModels] = useState<ModelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { message: copiedModel, setMessage: setCopiedModel } = useTimedMessage<string>(null, 1500);

  useEffect(() => {
    fetchModels()
      .then((res: { data: ModelData[] }) => {
        setModels(res.data || []);
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  const providers = ["all", ...Array.from(new Set(models.map((m) => m.owned_by)))];
  const providerCounts = new Map<string, number>();
  for (const m of models) {
    providerCounts.set(m.owned_by, (providerCounts.get(m.owned_by) || 0) + 1);
  }

  const filtered = models
    .filter((m) => filter === "all" || m.owned_by === filter)
    .filter((m) =>
      search === "" ||
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.owned_by.toLowerCase().includes(search.toLowerCase())
    );

  const thinkingCount = models.filter((m) => m.thinking).length;
  const visionCount = models.filter((m) => m.vision).length;

  async function copyModelId(modelId: string) {
    await navigator.clipboard.writeText(modelId);
    setCopiedModel(modelId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Models</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {models.length} models available across {new Set(models.map((m) => m.owned_by)).size} providers
          </p>
        </div>
        {/* Quick stats */}
        <div className="flex items-center gap-3">
          {thinkingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              <Brain className="w-3 h-3" /> {thinkingCount} Thinking
            </span>
          )}
          {visionCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--info)]/10 text-[var(--info)]">
              <Eye className="w-3 h-3" /> {visionCount} Vision
            </span>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 h-9 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {providers.map((p) => {
            const count = p === "all" ? models.length : (providerCounts.get(p) || 0);
            return (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  filter === p
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30 shadow-sm"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] border border-transparent hover:text-[var(--foreground)] hover:border-[var(--border)]"
                }`}
              >
                {p !== "all" && <ProviderIcon provider={p} size={14} />}
                {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
                <span className={`text-[10px] ${filter === p ? "text-[var(--primary)]/70" : "text-[var(--muted-foreground)]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((model) => (
          <Card
            key={model.id}
            className="border-[var(--border)] group hover:border-[var(--primary)]/30 hover:shadow-md hover:shadow-[var(--primary)]/5 transition-all duration-200"
          >
            <CardContent className="p-4 space-y-3">
              {/* Model name + copy */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate font-mono">
                    {model.id}
                  </p>
                  <span className={`inline-flex items-center gap-1 mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium border ${providerColors[model.owned_by] || "bg-[var(--muted)]/20 text-[var(--muted-foreground)] border-[var(--border)]"}`}>
                    <ProviderIcon provider={model.owned_by} size={12} />
                    {model.owned_by}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyModelId(model.id)}
                  title={`Copy: ${model.id}`}
                  className="p-1.5 rounded-md hover:bg-[var(--secondary)] transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                >
                  {copiedModel === model.id ? (
                    <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                  )}
                </button>
              </div>

              {/* Specs row */}
              <div className="flex items-center gap-3 text-[11px]">
                {model.context_window && (
                  <span className="inline-flex items-center gap-1 text-[var(--muted-foreground)]">
                    <MessageSquare className="w-3 h-3" />
                    <span className="text-[var(--foreground)] font-medium">{formatContext(model.context_window)}</span> ctx
                  </span>
                )}
                {model.max_output && (
                  <span className="inline-flex items-center gap-1 text-[var(--muted-foreground)]">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[var(--foreground)] font-medium">{formatNumber(model.max_output)}</span> out
                  </span>
                )}
              </div>

              {/* Feature badges */}
              {(model.thinking || model.vision) && (
                <div className="flex items-center gap-1.5">
                  {model.thinking && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
                      <Brain className="w-3 h-3" /> Thinking
                    </span>
                  )}
                  {model.vision && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--info)]/10 text-[var(--info)] font-medium">
                      <Eye className="w-3 h-3" /> Vision
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Cpu className="w-12 h-12 text-[var(--muted-foreground)] mb-4" />
          <p className="text-[var(--foreground)] font-medium">No models found</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Try adjusting your search or filter
          </p>
        </div>
      )}
    </div>
  );
}

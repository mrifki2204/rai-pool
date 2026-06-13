import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Check,
  Copy,
  Zap,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  ChevronsUpDown,
  Info,
  AlertTriangle,
  Download,
} from "lucide-react";
import type { ClientMetaDTO, IntegrationModelDTO } from "@/lib/api";
import { fetchClientConfigPreview } from "@/lib/api";
import { ConfigPreview } from "./ConfigPreview";

interface ClientCardProps {
  client: ClientMetaDTO;
  baseUrl: string;
  apiKey: string;
  model: string;
  models: IntegrationModelDTO[];
  showPreview?: boolean;
  onModelChange: (model: string) => void;
  onApply: (clientId: string, model: string) => Promise<void>;
  onRestore: (clientId: string) => Promise<void>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* */ }
      }}
      className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function ClientCard({
  client,
  baseUrl,
  apiKey,
  model,
  models,
  showPreview,
  onModelChange,
  onApply,
  onRestore,
}: ClientCardProps) {
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showPreview !== false && !previewData && !previewLoading && client.detected) {
      setPreviewLoading(true);
      setPreviewError(null);
      fetchClientConfigPreview(client.id, baseUrl, model)
        .then((data) => {
          if (data.success && data.preview) {
            setPreviewData(data.preview);
          } else if (data.error) {
            setPreviewError(data.error);
          }
        })
        .catch((e) => setPreviewError(e.message || "Failed to load preview"))
        .finally(() => setPreviewLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, baseUrl, model, showPreview, client.detected]);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) { document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey); }
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const filtered = query.trim()
    ? models.filter((m) => m.id.toLowerCase().includes(query.trim().toLowerCase()))
    : models;

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(client.id, model);
      setStatus({ ok: true, msg: "Applied" });
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message || "Failed" });
    } finally {
      setApplying(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await onRestore(client.id);
      setStatus({ ok: true, msg: "Restored" });
    } catch (e: any) {
      setStatus({ ok: false, msg: e.message || "Failed" });
    } finally {
      setRestoring(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  return (
    <Card className={!client.detected ? "opacity-85" : ""}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                client.detected ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"
              }`}
              title={client.detected ? "Installed" : "Not installed"}
            />
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-[var(--foreground)] truncate">
                {client.name}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                {client.detected ? `${client.cli} — detected` : `${client.cli} — not installed`}
              </p>
            </div>
          </div>
          <a
            href={client.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] shrink-0 flex items-center gap-1 text-[11px]"
            title="Docs / Install"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--muted-foreground)]">{client.description}</p>

        {/* Not installed banner */}
        {!client.detected && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-[var(--secondary)] text-xs">
            <Info className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-medium text-[var(--foreground)]">Not installed</span>
              <p className="text-[var(--muted-foreground)]">
                Install{" "}
                <a href={client.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--foreground)]">
                  {client.name}
                </a>{" "}
                first, then configure it to use this proxy. After installing, refresh this page.
              </p>
            </div>
          </div>
        )}

        {/* Config paths */}
        <div className="text-[11px] text-[var(--muted-foreground)] space-y-0.5">
          {client.configPaths.map((p) => (
            <div key={p} className="truncate font-mono" title={p}>{p}</div>
          ))}
        </div>

        {/* Model selector */}
        <div ref={ref} className="relative">
          <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-1 block">Model</label>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <span className="truncate text-[var(--foreground)]">{model || "— select —"}</span>
            <ChevronsUpDown className="w-4 h-4 opacity-60 shrink-0" />
          </button>
          {open && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] shadow-lg">
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--border)]">
                <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search models..."
                  className="w-full bg-transparent text-sm focus:outline-none text-[var(--foreground)]"
                />
              </div>
              <ul className="max-h-[14rem] overflow-y-auto py-1">
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => { onModelChange(m.id); setOpen(false); setQuery(""); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--secondary)] flex items-center justify-between gap-2 ${model === m.id ? "bg-[var(--secondary)]" : ""}`}
                    >
                      <span className="truncate text-[var(--foreground)]">{m.id}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 px-1.5 py-0.5 rounded bg-[var(--background)]">
                        {m.owned_by}
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-3 py-2 text-xs text-[var(--muted-foreground)]">No match</li>}
              </ul>
            </div>
          )}
        </div>

        {/* Preview */}
        {showPreview !== false && client.detected && (
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">Config Preview</span>
            {previewLoading ? (
              <div className="px-3 py-4 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
              </div>
            ) : previewError ? (
              <div className="px-3 py-2 rounded-md border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 text-xs text-[var(--destructive)] flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                {previewError}
              </div>
            ) : previewData ? (
              <ConfigPreview config={previewData} />
            ) : null}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleApply}
            disabled={applying || !client.detected}
            className="gap-1.5 text-xs h-8"
            title={!client.detected ? "Install the client first, then refresh this page" : undefined}
          >
            {applying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRestore}
            disabled={restoring || !client.detected}
            className="text-xs h-8"
          >
            Restore
          </Button>
          {status && (
            <span className={`text-xs ml-auto flex items-center gap-1 ${status.ok ? "text-[var(--success)]" : "text-[var(--destructive)]"}`}>
              {status.ok ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {status.msg}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

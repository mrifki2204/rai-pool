import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Search,
  ChevronsUpDown,
  Check,
  Terminal,
  Zap,
  RefreshCw,
  Code,
  Box,
  Hammer,
  PawPrint,
  Info,
  AlertTriangle,
  ExternalLink,
  Copy,
  CheckCircle2,
  Circle,
  Wifi,
  WifiOff,
  ShieldCheck,
  ShieldX,
  Link2,
  Globe,
  Key,
  Layers,
  Plug,
  Plus,
  X,
} from "lucide-react";
import {
  fetchIntegration,
  saveIntegration,
  fetchApiKey,
  applyIntegrationConfig,
  fetchIntegrationClients,
  applyClientConfig,
  restoreClientConfig,
  fetchClientConfigPreview,
  fetchModels,
  fetchAccounts,
  API_BASE,
  type ModelMappingDTO,
  type ClientMetaDTO,
  type IntegrationModelDTO,
} from "@/lib/api";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { useWsEvent } from "@/hooks/useWebSocket";

const CLAUDE_CODE_SLOTS = [
  { source: "haiku", title: "Haiku", desc: "small / fast / background" },
  { source: "sonnet", title: "Sonnet", desc: "main coding model" },
  { source: "opus", title: "Opus", desc: "heavy reasoning" },
] as const;

const CLIENT_ICONS: Record<string, typeof Terminal> = {
  claude: Terminal,
  opencode: Code,
  codex: Box,
  hermes: Hammer,
  openclaw: PawPrint,
  kilo: Zap,
};

function ModelCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; owned_by: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef && !containerRef.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, containerRef]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.id.toLowerCase().includes(q) || o.owned_by.toLowerCase().includes(q))
    : options;

  return (
    <div ref={setContainerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 transition-colors hover:border-[var(--primary)]/30"
      >
        <span className={value ? "truncate text-[var(--foreground)] font-mono text-xs" : "truncate text-[var(--muted-foreground)] text-xs"}>
          {value || "— pass through (no mapping) —"}
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
            <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-transparent text-sm focus:outline-none text-[var(--foreground)]"
            />
          </div>
          <ul className="max-h-[18rem] overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--secondary)] flex items-center justify-between ${!value ? "bg-[var(--secondary)]" : ""}`}
              >
                <span className="text-[var(--muted-foreground)]">— pass through —</span>
                {!value && <Check className="w-3.5 h-3.5 text-[var(--primary)]" />}
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--secondary)] flex items-center justify-between gap-2 ${value === o.id ? "bg-[var(--secondary)]" : ""}`}
                >
                  <span className="truncate text-[var(--foreground)] font-mono text-xs">{o.id}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--background)]">
                    {o.owned_by}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-[var(--muted-foreground)]">No models match "{query}".</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Integration() {
  const [enabled, setEnabled] = useState(true);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [models, setModels] = useState<{ id: string; owned_by: string }[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [clients, setClients] = useState<ClientMetaDTO[]>([]);
  const [integrationModels, setIntegrationModels] = useState<IntegrationModelDTO[]>([]);
  const { message, setMessage } = useTimedMessage<{ text: string; ok: boolean } | null>(null, 4000);

  const [connTest, setConnTest] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const baseUrl = API_BASE;

  const [clientModels, setClientModels] = useState<Record<string, string>>({
    opencode: "",
    codex: "",
    hermes: "",
    openclaw: "",
    kilo: "",
  });
  // OpenCode & Hermes support multi-model
  const [multiModelSelections, setMultiModelSelections] = useState<Record<string, string[]>>({
    opencode: [],
    hermes: [],
  });
  const MULTI_MODEL_CLIENTS = ["opencode", "hermes"];

  // Helper to get/set multi-model for current dialog client
  const getMultiModels = (clientId: string) => multiModelSelections[clientId] || [];
  const setMultiModels = (clientId: string, models: string[]) =>
    setMultiModelSelections((prev) => ({ ...prev, [clientId]: models }));

  // Claude Code dialog
  const [claudeDialogOpen, setClaudeDialogOpen] = useState(false);
  const [claudeModels, setClaudeModels] = useState<{ id: string; owned_by: string; context_window?: number }[]>([]);
  const [claudeActiveProviders, setClaudeActiveProviders] = useState<Set<string>>(new Set());
  const [claudeExpandedSlot, setClaudeExpandedSlot] = useState<string | null>(null);
  const [claudeManualOpen, setClaudeManualOpen] = useState(false);
  const [claudeResetting, setClaudeResetting] = useState(false);

  // Client dialog
  const [dialogClient, setDialogClient] = useState<ClientMetaDTO | null>(null);
  const [dialogApplying, setDialogApplying] = useState(false);
  const [dialogRestoring, setDialogRestoring] = useState(false);
  const [dialogPreview, setDialogPreview] = useState<Record<string, unknown> | null>(null);
  const [dialogPreviewLoading, setDialogPreviewLoading] = useState(false);
  const [dialogStatus, setDialogStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dialogModelOpen, setDialogModelOpen] = useState(false);
  const [dialogManualOpen, setDialogManualOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, keyRes] = await Promise.all([
        fetchIntegration(),
        fetchApiKey().catch(() => null),
      ]);
      setEnabled(data.enabled);
      setModels(data.models || []);
      const next: Record<string, string> = {};
      for (const slot of CLAUDE_CODE_SLOTS) {
        const found = (data.mappings || []).find(
          (m) => m.sourcePattern.toLowerCase() === slot.source
        );
        next[slot.source] = found?.targetModel || "";
      }
      setTargets(next);
      if (keyRes?.key) setApiKey(keyRes.key);
    } catch (e: any) {
      setMessage({ text: e.message || "Failed to load", ok: false });
    } finally {
      setLoading(false);
    }
  }, [setMessage]);

  const loadClients = useCallback(async () => {
    try {
      const data = await fetchIntegrationClients();
      setClients(data.clients || []);
      setIntegrationModels(data.models || []);
    } catch (e: any) {
      console.error("Failed to load clients:", e);
    }
  }, []);

  useEffect(() => { load(); loadClients(); }, [load, loadClients]);
  useWsEvent(["model_mappings_updated"], load);

  const testConnection = async () => {
    setConnTest("testing");
    try {
      const resp = await fetch(`${baseUrl}/api/health`);
      if (resp.ok) {
        setConnTest("ok");
        setMessage({ text: "Proxy is reachable", ok: true });
      } else {
        setConnTest("fail");
        setMessage({ text: `Proxy returned ${resp.status}`, ok: false });
      }
    } catch {
      setConnTest("fail");
      setMessage({ text: "Cannot reach proxy — is the server running?", ok: false });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const mappings: ModelMappingDTO[] = CLAUDE_CODE_SLOTS.map((slot, i) => ({
        sourcePattern: slot.source,
        matchType: "contains",
        targetModel: targets[slot.source] || "",
        enabled: Boolean(targets[slot.source]),
        priority: i,
        label: `the assistant · ${slot.title}`,
      }));
      await saveIntegration({ enabled, mappings });
      setMessage({ text: "Model mappings saved", ok: true });
    } catch (e: any) {
      setMessage({ text: e.message || "Save failed", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyConfig = async () => {
    setApplying(true);
    try {
      await applyIntegrationConfig(baseUrl);
      setMessage({ text: "Config applied — restart Claude Code to take effect", ok: true });
    } catch (e: any) {
      setMessage({ text: e.message || "Failed to apply", ok: false });
    } finally {
      setApplying(false);
    }
  };

  // Load models + active providers for Claude dialog
  async function loadClaudeModels() {
    try {
      const [modelsRes, accountsRes] = await Promise.all([
        fetchModels() as Promise<{ data: { id: string; owned_by: string; context_window?: number }[] }>,
        fetchAccounts() as Promise<{ data: { provider: string; status: string }[] }>,
      ]);
      setClaudeModels(modelsRes.data || []);
      const activeProvs = new Set<string>();
      for (const a of (accountsRes.data || [])) {
        if (a.status === "active") activeProvs.add(a.provider);
      }
      setClaudeActiveProviders(activeProvs);
    } catch { /* ignore */ }
  }

  function openClaudeDialog() {
    setClaudeDialogOpen(true);
    setClaudeExpandedSlot(null);
    loadClaudeModels();
  }

  async function handleClaudeReset() {
    if (!confirm("Reset all Claude Code model mappings? This will clear all slot configurations.")) return;
    setClaudeResetting(true);
    try {
      setTargets({ haiku: "", sonnet: "", opus: "" });
      const mappings: ModelMappingDTO[] = CLAUDE_CODE_SLOTS.map((slot, i) => ({
        sourcePattern: slot.source,
        matchType: "contains",
        targetModel: "",
        enabled: false,
        priority: i,
        label: `the assistant · ${slot.title}`,
      }));
      await saveIntegration({ enabled, mappings });
      setMessage({ text: "Claude Code mappings reset", ok: true });
    } catch (e: any) {
      setMessage({ text: e.message || "Reset failed", ok: false });
    } finally {
      setClaudeResetting(false);
    }
  }

  function getClaudeManualConfig(): { path: string; json: string } {
    const config: Record<string, any> = {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey || "<YOUR_API_KEY>",
      },
    };
    // Include model info as comment-like fields
    const mappingInfo: Record<string, string> = {};
    for (const slot of CLAUDE_CODE_SLOTS) {
      if (targets[slot.source]) {
        mappingInfo[`model_${slot.source}`] = targets[slot.source];
      }
    }
    if (Object.keys(mappingInfo).length > 0) {
      config._model_mappings = mappingInfo;
    }
    return {
      path: "~/.claude/settings.json",
      json: JSON.stringify(config, null, 2),
    };
  }

  // Client dialog handlers
  function openClientDialog(client: ClientMetaDTO) {
    setDialogClient(client);
    setDialogStatus(null);
    setDialogPreview(null);
    setDialogModelOpen(false);
    setDialogPreviewLoading(true);

    // Load current config preview and extract active model(s)
    fetchClientConfigPreview(client.id, baseUrl, "")
      .then((data) => {
        if (data.success && data.preview) {
          setDialogPreview(data.preview);
          // Extract current model(s) from config
          const preview = data.preview as any;
          if (client.id === "opencode") {
            // Read models from provider.rai.models keys
            const raiModels = Object.keys(preview?.provider?.rai?.models || {});
            if (raiModels.length > 0 && getMultiModels(client.id).length === 0) {
              setMultiModels(client.id, raiModels);
            }
          } else if (client.id === "hermes") {
            // Read from YAML default model
            let currentModel = "";
            if (typeof preview.yaml === "string") {
              const match = preview.yaml.match(/default:\s*(?:rai\/)?(\S+)/);
              if (match) currentModel = match[1];
            }
            if (currentModel && getMultiModels(client.id).length === 0) {
              setMultiModels(client.id, [currentModel]);
            }
          } else {
            // Single model clients (codex, openclaw, kilo)
            let currentModel = "";
            if (preview.model && typeof preview.model === "string") {
              currentModel = preview.model.replace(/^rai\//, "");
            }
            if (currentModel && !clientModels[client.id]) {
              setClientModels((p) => ({ ...p, [client.id]: currentModel }));
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setDialogPreviewLoading(false));
  }

  function closeClientDialog() {
    setDialogClient(null);
    setDialogStatus(null);
    setDialogPreview(null);
    setDialogModelOpen(false);
    setDialogManualOpen(false);
  }

  async function dialogApply() {
    if (!dialogClient) return;
    setDialogApplying(true);
    setDialogStatus(null);
    try {
      if (MULTI_MODEL_CLIENTS.includes(dialogClient.id)) {
        const models = getMultiModels(dialogClient.id);
        const defaultModel = models[0] || "";
        await applyClientConfig(dialogClient.id, baseUrl, defaultModel, models);
      } else {
        await applyClientConfig(dialogClient.id, baseUrl, clientModels[dialogClient.id] || "");
      }
      setDialogStatus({ ok: true, msg: "Config applied! Restart the client to take effect." });
      await loadClients();
    } catch (e: any) {
      setDialogStatus({ ok: false, msg: e.message || "Failed to apply" });
    } finally {
      setDialogApplying(false);
    }
  }

  async function dialogRestore() {
    if (!dialogClient) return;
    if (!confirm(`Reset ${dialogClient.name} configuration? This will clear the selected model(s).`)) return;
    setDialogRestoring(true);
    setDialogStatus(null);
    try {
      // Clear local state
      if (MULTI_MODEL_CLIENTS.includes(dialogClient!.id)) {
        setMultiModels(dialogClient!.id, []);
      }
      setClientModels((p) => ({ ...p, [dialogClient!.id]: "" }));
      // Try to restore backup on server
      try {
        const res = await restoreClientConfig(dialogClient.id);
        if (res?.success) {
          setDialogStatus({ ok: true, msg: "Config restored from backup. Restart the client." });
        } else {
          setDialogStatus({ ok: true, msg: "Selection cleared. Re-apply to update config file." });
        }
      } catch {
        setDialogStatus({ ok: true, msg: "Selection cleared. Re-apply to update config file." });
      }
      await loadClients();
    } catch (e: any) {
      setDialogStatus({ ok: false, msg: e.message || "Reset failed" });
    } finally {
      setDialogRestoring(false);
    }
  }

  useEffect(() => {
    if (!dialogClient) return;
    setDialogPreviewLoading(true);
    setDialogPreview(null);
    const isMulti = MULTI_MODEL_CLIENTS.includes(dialogClient.id);
    const models = isMulti ? getMultiModels(dialogClient.id) : [];
    const model = isMulti ? (models[0] || "") : (clientModels[dialogClient.id] || "");
    fetchClientConfigPreview(dialogClient.id, baseUrl, model, isMulti && models.length > 0 ? models : undefined)
      .then((data) => { if (data.success && data.preview) setDialogPreview(data.preview); })
      .catch(() => {})
      .finally(() => setDialogPreviewLoading(false));
  }, [dialogClient?.id, clientModels[dialogClient?.id || ""], multiModelSelections]);

  const mappedCount = Object.values(targets).filter(Boolean).length;
  const hasMappings = mappedCount > 0 && enabled;
  const detectedClients = clients.filter((c) => c.detected).length;
  const totalClients = clients.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--info)]/10 border border-[var(--primary)]/20">
            <Link2 className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Integration</h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              Connect AI coding tools to your proxy pool
            </p>
          </div>
        </div>
        <button
          onClick={testConnection}
          disabled={connTest === "testing"}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            connTest === "ok"
              ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20"
              : connTest === "fail"
                ? "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20"
                : "bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--primary)]/30"
          }`}
        >
          {connTest === "testing" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : connTest === "ok" ? <Wifi className="w-3.5 h-3.5" /> : connTest === "fail" ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          {connTest === "ok" ? "Connected" : connTest === "fail" ? "Unreachable" : "Test Connection"}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 border ${message.ok ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" : "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20"}`}>
          {message.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-[var(--border)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--primary)]/10">
              <Globe className="w-4 h-4 text-[var(--primary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--muted-foreground)]">Proxy Endpoint</p>
              <p className="text-sm font-mono font-medium text-[var(--foreground)] truncate">{baseUrl}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--border)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--info)]/10">
              <Layers className="w-4 h-4 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Model Mappings</p>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {mappedCount}/3 configured
                {hasMappings && <span className="ml-1.5 text-[var(--success)] text-[11px]">● Active</span>}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--border)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--success)]/10">
              <Plug className="w-4 h-4 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Clients Detected</p>
              <p className="text-sm font-medium text-[var(--foreground)]">{detectedClients}/{totalClients} installed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Coding Clients — All in one grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">AI Coding Clients</h3>
          <span className="text-[11px] text-[var(--muted-foreground)]">Click to configure</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Claude Code — first card, special styling */}
          <button
            onClick={openClaudeDialog}
            className="text-left rounded-xl border-2 border-[var(--primary)]/30 bg-gradient-to-br from-[var(--primary)]/5 to-transparent p-4 transition-all hover:border-[var(--primary)]/50 hover:shadow-md hover:shadow-[var(--primary)]/10"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[var(--primary)]/15">
                <Terminal className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Claude Code</span>
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] font-medium">
                    Primary
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {hasMappings ? `${mappedCount}/3 mapped · routing active` : "Proxy connection + model mapping"}
                </p>
              </div>
            </div>
          </button>

          {/* Other clients */}
          {clients.map((client) => {
            const Icon = CLIENT_ICONS[client.id] || Code;
            return (
              <button
                key={client.id}
                onClick={() => openClientDialog(client)}
                className="text-left rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--primary)]/30 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${client.detected ? "bg-[var(--success)]/10" : "bg-[var(--secondary)]"}`}>
                    <Icon className={`w-5 h-5 ${client.detected ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{client.name}</span>
                      {client.detected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)]">
                          <span className="w-1 h-1 rounded-full bg-[var(--success)]" /> Installed
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
                          Not found
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">{client.description}</p>
                  </div>
                </div>
              </button>
            );
          })}

          {clients.length === 0 && (
            <div className="col-span-full flex items-center gap-2 px-4 py-8 text-sm text-[var(--muted-foreground)] justify-center rounded-xl border border-dashed border-[var(--border)]">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading clients...
            </div>
          )}
        </div>
      </div>

      {/* ═══ Claude Code Dialog ═══ */}
      <Dialog open={claudeDialogOpen} onOpenChange={setClaudeDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--primary)]/20 to-emerald-500/10">
                <Terminal className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                <DTitle>Claude Code</DTitle>
                <DialogDescription>Configure model for each slot</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Slot rows with inline select */}
          <div className="space-y-2">
            {CLAUDE_CODE_SLOTS.map((slot) => {
              const selectedModel = targets[slot.source] || "";
              const selectedProvider = selectedModel ? claudeModels.find(m => m.id === selectedModel)?.owned_by : null;
              const isOpen = claudeExpandedSlot === slot.source;

              // Group models by provider, active first
              const grouped = new Map<string, typeof claudeModels>();
              for (const m of claudeModels) {
                const list = grouped.get(m.owned_by) || [];
                list.push(m);
                grouped.set(m.owned_by, list);
              }
              const entries = Array.from(grouped.entries()).sort((a, b) => {
                return (claudeActiveProviders.has(a[0]) ? 0 : 1) - (claudeActiveProviders.has(b[0]) ? 0 : 1);
              });

              return (
                <div key={slot.source} className="rounded-xl border border-[var(--border)] overflow-hidden">
                  {/* Row: icon + info + select button */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      selectedModel
                        ? "bg-gradient-to-br from-[var(--success)]/20 to-[var(--success)]/5 text-[var(--success)] border border-[var(--success)]/30"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                    }`}>
                      {slot.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--foreground)]">{slot.title}</div>
                      {selectedModel ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono text-[var(--primary)] truncate">{selectedModel}</span>
                          {selectedProvider && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)] shrink-0">{selectedProvider}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[var(--muted-foreground)]">{slot.desc}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setClaudeExpandedSlot(isOpen ? null : slot.source)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                        selectedModel
                          ? "bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--secondary)]/80 border border-[var(--border)]"
                          : "bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/20"
                      }`}
                    >
                      <ChevronsUpDown className="w-3 h-3" />
                      {selectedModel ? "Change" : "Select"}
                    </button>
                  </div>

                  {/* Dropdown model list */}
                  {isOpen && (
                    <div className="border-t border-[var(--border)] bg-[var(--background)] max-h-[240px] overflow-y-auto">
                      {entries.map(([provider, provModels]) => {
                        const provActive = claudeActiveProviders.has(provider);
                        return (
                          <div key={provider} className={!provActive ? "opacity-40" : ""}>
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--secondary)]/30 sticky top-0">
                              <span className={`w-2 h-2 rounded-full ${provActive ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"}`} />
                              <span className="text-[11px] font-semibold text-[var(--foreground)] capitalize">{provider}</span>
                              {!provActive && <span className="text-[10px] text-[var(--muted-foreground)]">no accounts</span>}
                            </div>
                            {provModels.map((m) => {
                              const isSel = selectedModel === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  disabled={!provActive}
                                  onClick={() => {
                                    setTargets((t) => ({ ...t, [slot.source]: m.id }));
                                    setClaudeExpandedSlot(null);
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-all disabled:cursor-not-allowed ${
                                    isSel ? "bg-[var(--primary)]/10" : "hover:bg-[var(--secondary)]/50"
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                    isSel ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)]"
                                  }`}>
                                    {isSel && <Check className="w-2.5 h-2.5" />}
                                  </div>
                                  <span className="text-xs font-mono text-[var(--foreground)] truncate flex-1">{m.id}</span>
                                  {m.context_window && (
                                    <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 tabular-nums">
                                      {m.context_window >= 1000000 ? `${(m.context_window/1000000).toFixed(0)}M` : `${(m.context_window/1000).toFixed(0)}K`}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                      {selectedModel && (
                        <button
                          type="button"
                          onClick={() => { setTargets((t) => ({ ...t, [slot.source]: "" })); setClaudeExpandedSlot(null); }}
                          className="w-full text-center text-[11px] text-[var(--muted-foreground)] hover:text-[var(--error)] hover:bg-[var(--error)]/5 py-2 transition-colors border-t border-[var(--border)]"
                        >
                          ✕ Clear selection
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions — 3 buttons */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
            <button
              onClick={async () => { await handleSave(); await handleApplyConfig(); }}
              disabled={saving || applying}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--primary)]/15 to-[var(--primary)]/5 border border-[var(--primary)]/30 text-[var(--primary)] hover:from-[var(--primary)]/25 hover:to-[var(--primary)]/10 transition-all disabled:opacity-50"
            >
              {(saving || applying) ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              <span className="text-[11px] font-semibold">Apply Config</span>
            </button>
            <button
              onClick={handleClaudeReset}
              disabled={claudeResetting}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--error)]/10 to-[var(--error)]/5 border border-[var(--error)]/20 text-[var(--error)] hover:from-[var(--error)]/20 hover:to-[var(--error)]/10 transition-all disabled:opacity-50"
            >
              {claudeResetting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
              <span className="text-[11px] font-semibold">Reset</span>
            </button>
            <button
              onClick={() => setClaudeManualOpen(true)}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--info)]/10 to-[var(--info)]/5 border border-[var(--info)]/20 text-[var(--info)] hover:from-[var(--info)]/20 hover:to-[var(--info)]/10 transition-all"
            >
              <Code className="w-5 h-5" />
              <span className="text-[11px] font-semibold">Manual Config</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Claude Manual Config Dialog ═══ */}
      <Dialog open={claudeManualOpen} onOpenChange={setClaudeManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--info)]/15">
                <Code className="w-5 h-5 text-[var(--info)]" />
              </div>
              <div>
                <DTitle>Manual Configuration</DTitle>
                <DialogDescription>Copy and paste this config manually</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {(() => {
            const { path, json } = getClaudeManualConfig();
            return (
              <div className="space-y-4">
                {/* Path */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">Config File Path</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] group">
                    <code className="text-sm font-mono text-[var(--foreground)] flex-1">{path}</code>
                    <CopyBtn value={path} />
                  </div>
                </div>

                {/* JSON */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">JSON Content</label>
                    <CopyBtn value={json} label="Copy JSON" />
                  </div>
                  <pre className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-xs font-mono text-[var(--foreground)] overflow-x-auto whitespace-pre max-h-64 overflow-y-auto leading-relaxed">
                    {json}
                  </pre>
                </div>

                {/* Instructions */}
                <div className="rounded-lg bg-[var(--secondary)]/50 border border-[var(--border)] p-3 space-y-1.5">
                  <p className="text-xs font-medium text-[var(--foreground)]">Instructions:</p>
                  <ol className="text-[11px] text-[var(--muted-foreground)] space-y-1 list-decimal list-inside">
                    <li>Copy the JSON above</li>
                    <li>Open <code className="bg-[var(--background)] px-1 rounded">{path}</code></li>
                    <li>Paste/merge the content</li>
                    <li>Restart Claude Code</li>
                  </ol>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══ Client Config Dialog ═══ */}
      <Dialog open={dialogClient !== null} onOpenChange={(open) => { if (!open) closeClientDialog(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {dialogClient && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${dialogClient.detected ? "bg-[var(--success)]/10" : "bg-[var(--secondary)]"}`}>
                    {(() => { const I = CLIENT_ICONS[dialogClient.id] || Code; return <I className={`w-5 h-5 ${dialogClient.detected ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}`} />; })()}
                  </div>
                  <div>
                    <DTitle className="flex items-center gap-2">
                      {dialogClient.name}
                      {dialogClient.detected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)] font-normal">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" /> Installed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] font-normal">
                          Not installed
                        </span>
                      )}
                    </DTitle>
                    <DialogDescription>{dialogClient.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {dialogStatus && (
                <div className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${dialogStatus.ok ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--error)]/10 text-[var(--error)]"}`}>
                  {dialogStatus.ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {dialogStatus.msg}
                </div>
              )}

              {!dialogClient.detected && (
                <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg bg-[var(--warning)]/5 border border-[var(--warning)]/20">
                  <Info className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
                  <div className="text-xs text-[var(--muted-foreground)] space-y-1">
                    <p className="font-medium text-[var(--foreground)]">Client not detected</p>
                    <p>Install <a href={dialogClient.url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">{dialogClient.name}</a> first.</p>
                  </div>
                </div>
              )}

              {/* ── OpenCode: Multi-model ── */}
              {MULTI_MODEL_CLIENTS.includes(dialogClient.id) ? (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-[var(--primary)]" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">Models</p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">{getMultiModels(dialogClient.id).length} selected</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDialogModelOpen(!dialogModelOpen)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/20 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Add Model
                    </button>
                  </div>

                  {/* Selected models list */}
                  {getMultiModels(dialogClient.id).length > 0 && (
                    <div className="border-t border-[var(--border)] px-3 py-2 space-y-1">
                      {getMultiModels(dialogClient.id).map((mid, idx) => (
                        <div key={mid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--secondary)]/50">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${idx === 0 ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>
                            {idx === 0 ? "default" : `#${idx + 1}`}
                          </span>
                          <span className="text-xs font-mono text-[var(--foreground)] truncate flex-1">{mid}</span>
                          <button
                            type="button"
                            onClick={() => setMultiModels(dialogClient.id, getMultiModels(dialogClient.id).filter((x) => x !== mid))}
                            className="p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--error)] transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add model dropdown — grouped by provider */}
                  {dialogModelOpen && (
                    <div className="border-t border-[var(--border)] bg-[var(--background)] max-h-[240px] overflow-y-auto">
                      {(() => {
                        const available = integrationModels.filter((m) => !getMultiModels(dialogClient.id).includes(m.id));
                        if (available.length === 0) {
                          return <p className="px-4 py-3 text-xs text-[var(--muted-foreground)] text-center">All models added</p>;
                        }
                        const grouped = new Map<string, typeof integrationModels>();
                        for (const m of available) {
                          const list = grouped.get(m.owned_by) || [];
                          list.push(m);
                          grouped.set(m.owned_by, list);
                        }
                        return Array.from(grouped.entries()).map(([provider, models]) => (
                          <div key={provider}>
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--secondary)]/40 sticky top-0 border-b border-[var(--border)]/30">
                              <span className="w-2 h-2 rounded-full bg-[var(--primary)]/60" />
                              <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">{provider}</span>
                              <span className="text-[10px] text-[var(--muted-foreground)]">({models.length})</span>
                            </div>
                            {models.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setMultiModels(dialogClient.id, [...getMultiModels(dialogClient.id), m.id]);
                                  setDialogModelOpen(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[var(--primary)]/5 transition-all"
                              >
                                <Plus className="w-3 h-3 text-[var(--primary)] shrink-0" />
                                <span className="text-xs font-mono text-[var(--foreground)] truncate flex-1">{m.id}</span>
                                {m.context_window && (
                                  <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 tabular-nums">
                                    {m.context_window >= 1000000 ? `${(m.context_window/1000000).toFixed(0)}M` : `${(m.context_window/1000).toFixed(0)}K`}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Other clients: Single model ── */
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-[var(--muted-foreground)]" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">Model</p>
                        {clientModels[dialogClient.id] ? (
                          <p className="text-[11px] font-mono text-[var(--primary)]">{clientModels[dialogClient.id]}</p>
                        ) : (
                          <p className="text-[11px] text-[var(--muted-foreground)]">No model selected</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDialogModelOpen(!dialogModelOpen)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        clientModels[dialogClient.id]
                          ? "bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)]/80"
                          : "bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/20"
                      }`}
                    >
                      <ChevronsUpDown className="w-3 h-3" />
                      {clientModels[dialogClient.id] ? "Change" : "Select"}
                    </button>
                  </div>

                  {dialogModelOpen && (
                    <div className="border-t border-[var(--border)] bg-[var(--background)] max-h-[220px] overflow-y-auto">
                      {integrationModels.map((m) => {
                        const isSel = clientModels[dialogClient.id] === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setClientModels((p) => ({ ...p, [dialogClient.id]: m.id }));
                              setDialogModelOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-all ${
                              isSel ? "bg-[var(--primary)]/10" : "hover:bg-[var(--secondary)]/50"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                              isSel ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)]"
                            }`}>
                              {isSel && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <span className="text-xs font-mono text-[var(--foreground)] truncate flex-1">{m.id}</span>
                            <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">{m.owned_by}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Config path */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20 px-3 py-2">
                <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Config Path</p>
                {dialogClient.configPaths.map((p) => (
                  <p key={p} className="text-[11px] font-mono text-[var(--foreground)] truncate" title={p}>{p}</p>
                ))}
              </div>

              {/* Actions — 3 buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  onClick={dialogApply}
                  disabled={dialogApplying || !dialogClient.detected}
                  className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--primary)]/15 to-[var(--primary)]/5 border border-[var(--primary)]/30 text-[var(--primary)] hover:from-[var(--primary)]/25 hover:to-[var(--primary)]/10 transition-all disabled:opacity-40"
                >
                  {dialogApplying ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  <span className="text-[11px] font-semibold">Apply Config</span>
                </button>
                <button
                  onClick={dialogRestore}
                  disabled={dialogRestoring || !dialogClient.detected}
                  className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--error)]/10 to-[var(--error)]/5 border border-[var(--error)]/20 text-[var(--error)] hover:from-[var(--error)]/20 hover:to-[var(--error)]/10 transition-all disabled:opacity-40"
                >
                  {dialogRestoring ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  <span className="text-[11px] font-semibold">Reset</span>
                </button>
                <button
                  onClick={() => setDialogManualOpen(true)}
                  className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--info)]/10 to-[var(--info)]/5 border border-[var(--info)]/20 text-[var(--info)] hover:from-[var(--info)]/20 hover:to-[var(--info)]/10 transition-all"
                >
                  <Code className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">Manual Config</span>
                </button>
              </div>

              {dialogPreviewLoading && (
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] py-2">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading config...
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Client Manual Config Dialog ═══ */}
      <Dialog open={dialogManualOpen} onOpenChange={setDialogManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--info)]/15">
                <Code className="w-5 h-5 text-[var(--info)]" />
              </div>
              <div>
                <DTitle>Manual Configuration</DTitle>
                <DialogDescription>
                  {dialogClient ? `${dialogClient.name} — copy and paste manually` : "Copy and paste manually"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {dialogClient && (
            <div className="space-y-4">
              {/* File 1: Main config */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  {dialogClient.id === "hermes" ? "1. Config File" : "Config File Path"}
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  <code className="text-xs font-mono text-[var(--foreground)] flex-1 truncate">
                    {dialogClient.configPaths[0] || "~/.config/" + dialogClient.id}
                  </code>
                  <CopyBtn value={dialogClient.configPaths[0] || ""} />
                </div>

                {/* Config content */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {dialogPreview && typeof dialogPreview.yaml === "string" ? "YAML" : "JSON"}
                  </span>
                  {dialogPreview && (
                    <CopyBtn
                      value={typeof dialogPreview.yaml === "string" ? dialogPreview.yaml : JSON.stringify(dialogPreview, null, 2)}
                      label="Copy"
                    />
                  )}
                </div>
                {dialogPreviewLoading ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
                  </div>
                ) : dialogPreview ? (
                  <pre className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[10px] font-mono text-[var(--foreground)] overflow-x-auto whitespace-pre max-h-52 overflow-y-auto leading-relaxed">
                    {typeof dialogPreview.yaml === "string" ? dialogPreview.yaml : JSON.stringify(dialogPreview, null, 2)}
                  </pre>
                ) : (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--muted-foreground)] text-center">
                    {dialogClient.detected ? "Select model and apply first" : "Install client first"}
                  </div>
                )}
              </div>

              {/* File 2: .env (Hermes only) */}
              {dialogClient.id === "hermes" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">2. Environment File</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                    <code className="text-xs font-mono text-[var(--foreground)] flex-1">%LOCALAPPDATA%/hermes/.env</code>
                    <CopyBtn value="%LOCALAPPDATA%/hermes/.env" />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-[var(--muted-foreground)]">ENV</span>
                    <CopyBtn value={`OPENAI_API_KEY=${apiKey || "<YOUR_API_KEY>"}`} label="Copy" />
                  </div>
                  <pre className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[10px] font-mono text-[var(--foreground)]">
                    {`OPENAI_API_KEY=${apiKey || "<YOUR_API_KEY>"}`}
                  </pre>
                </div>
              )}

              {/* Instructions */}
              <div className="rounded-lg bg-[var(--secondary)]/50 border border-[var(--border)] p-3 space-y-1.5">
                <p className="text-xs font-medium text-[var(--foreground)]">Instructions:</p>
                <ol className="text-[11px] text-[var(--muted-foreground)] space-y-1 list-decimal list-inside">
                  {dialogClient.id === "hermes" ? (
                    <>
                      <li>Copy config YAML → paste ke <code className="bg-[var(--background)] px-1 rounded">~/.hermes/config.yaml</code></li>
                      <li>Copy .env content → paste ke <code className="bg-[var(--background)] px-1 rounded">%LOCALAPPDATA%/hermes/.env</code></li>
                      <li>Restart Hermes</li>
                    </>
                  ) : (
                    <>
                      <li>Copy the config above</li>
                      <li>Open <code className="bg-[var(--background)] px-1 rounded">{dialogClient.configPaths[0] || "config file"}</code></li>
                      <li>Paste/merge the content</li>
                      <li>Restart {dialogClient.name}</li>
                    </>
                  )}
                </ol>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
      }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* */ }
  };
  return (
    <div>
      <label className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1 block">{label}</label>
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] group hover:border-[var(--primary)]/20 transition-colors">
        <code className="text-[11px] font-mono text-[var(--foreground)] truncate flex-1">{value}</code>
        <button
          onClick={copy}
          className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

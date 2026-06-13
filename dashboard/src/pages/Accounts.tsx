import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Upload, RefreshCw, Play, RotateCcw, Flame, ChevronDown, ChevronRight, Loader2, Key, Pencil, Trash2, Zap, FlaskConical, Lock, Shield, Users, AlertTriangle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useWsEvent } from "@/hooks/useWebSocket";
import ProviderIcon, { providerGradients } from "@/components/dashboard/ProviderIcon";
import {
  completeCodexOAuthCallbackUrl,
  createAccount,
  createByokProvider,
  deleteByokProvider,
  fetchAccounts,
  fetchApi,
  fetchAuthQueue,
  fetchAutoWarmupStatus,
  fetchByokProviders,
  fetchSettings,
  fetchWarmupQueue,
  getCodexAuthorize,
  importAccounts,
  loginAccounts,
  loginAllAccounts,
  pollCodexOAuthStatus,
  startCodexOAuthProxy,
  stopCodexOAuth,
  testByokProvider,
  updateByokProvider,
  updateSettings,
  warmupAllAccounts,
  type AutoWarmupStatus,
  type ByokProvider,
} from "@/lib/api";

type Provider = "kiro" | "kiro-pro" | "codebuddy" | "canva" | "codex" | "qoder";

interface Account {
  id: number;
  email: string;
  provider: Provider;
  status: string;
  quotaLimit?: number;
  quotaRemaining?: number;
}

const providers: Provider[] = ["kiro", "kiro-pro", "codebuddy", "canva", "codex", "qoder"];

function labelProvider(provider: string) {
  if (provider === "kiro-pro") return "Kiro Pro";
  if (provider === "codebuddy") return "CodeBuddy";
  if (provider === "codex") return "Codex";
  if (provider === "qoder") return "Qoder";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

const providerColors: Record<string, string> = {
  kiro: "#38bdf8",
  "kiro-pro": "#818cf8",
  codebuddy: "#f472b6",
  canva: "#a78bfa",
  codex: "#34d399",
  qoder: "#fbbf24",
};

export default function Accounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<any>(null);
  const [warmupQueue, setWarmupQueue] = useState<any>(null);
  const [warmupProgress, setWarmupProgress] = useState<Record<string, { total: number; completed: number; active: number }>>({});
  const [autoWarmup, setAutoWarmup] = useState<AutoWarmupStatus | null>(null);
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({});
  const [now, setNow] = useState<number>(Date.now());

  const [addForm, setAddForm] = useState({ email: "", password: "", provider: "kiro" as Provider, browserEngine: "camoufox", headless: false });
  const [addDialogProvider, setAddDialogProvider] = useState<Provider | null>(null);
  const [instantTokens, setInstantTokens] = useState("");
  const [cookieValue, setCookieValue] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [addMode, setAddMode] = useState<"single" | "bulk" | "instant" | "pat">("bulk");
  const [bulkBrowserEngine, setBulkBrowserEngine] = useState("camoufox");
  const [bulkHeadless, setBulkHeadless] = useState(true);
  const [bulkConcurrency, setBulkConcurrency] = useState(3);
  const [codexOauthBusy, setCodexOauthBusy] = useState(false);
  const [codexOauthAuthUrl, setCodexOauthAuthUrl] = useState("");
  const [codexOauthCallbackUrl, setCodexOauthCallbackUrl] = useState("");
  const [loginPendingDialog, setLoginPendingDialog] = useState(false);
  const [loginPendingConcurrency, setLoginPendingConcurrency] = useState(2);
  const [byokProviders, setByokProviders] = useState<ByokProvider[]>([]);
  const [byokDialogOpen, setByokDialogOpen] = useState(false);
  const [byokEditId, setByokEditId] = useState<number | null>(null);
  const [byokForm, setByokForm] = useState({
    label: "",
    base_url: "",
    api_key: "",
    format: "auto" as "openai" | "anthropic" | "auto",
    models: "",
  });
  const [expandedByokId, setExpandedByokId] = useState<number | null>(null);
  const [byokTestResults, setByokTestResults] = useState<
    Map<string, { status: 'testing' | 'success' | 'error'; latencyMs?: number; error?: string }>
  >(new Map());
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codexOauthPopupRef = useRef<Window | null>(null);
  const codexOauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codexOauthStateRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  async function load() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const [accountsRes, queueRes, warmupQueueRes, autoWarmupRes, settingsRes] = await Promise.all([
        fetchAccounts() as Promise<{ data: Account[] }>,
        fetchAuthQueue().catch(() => null),
        fetchWarmupQueue().catch(() => null),
        fetchAutoWarmupStatus().catch(() => null),
        fetchSettings().catch(() => null) as Promise<{ data: Record<string, string> } | null>,
      ]);
      setAccounts(accountsRes.data || []);
      setQueue(queueRes);
      setWarmupQueue(warmupQueueRes);
      setAutoWarmup(autoWarmupRes);
      setSettingsMap(settingsRes?.data || {});
      updateWarmupQueue(warmupQueueRes);

      const byokRes = await fetchByokProviders();
      setByokProviders(byokRes.providers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!autoWarmup?.nextRunAt) return;
    const targetMs = new Date(autoWarmup.nextRunAt).getTime();
    let refetched = false;
    const tick = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (!refetched && current >= targetMs) {
        refetched = true;
        setTimeout(() => {
          fetchAutoWarmupStatus().then(setAutoWarmup).catch(() => {});
          load();
        }, 1500);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [autoWarmup?.nextRunAt]);

  const reloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmupReloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReload = () => {
    if (reloadRef.current) clearTimeout(reloadRef.current);
    reloadRef.current = setTimeout(() => { load(); }, 800);
  };

  function updateWarmupQueue(res: any) {
    if (!res?.data || typeof res.data !== "object") {
      setWarmupProgress({});
      return;
    }
    const next: Record<string, { total: number; completed: number; active: number }> = {};
    for (const [provider, val] of Object.entries(res.data)) {
      const info = val as any;
      const total = Number(info.total || 0);
      const completed = Number(info.completed || 0);
      const active = Number(info.active || 0);
      if (total > 0) {
        next[provider] = { total, completed, active };
      }
    }
    setWarmupProgress(next);
  }

  const scheduleWarmupReload = () => {
    if (warmupReloadRef.current) clearTimeout(warmupReloadRef.current);
    warmupReloadRef.current = setTimeout(async () => {
      try {
        const res = await fetchWarmupQueue();
        updateWarmupQueue(res);
      } catch {}
    }, 500);
  };

  useEffect(() => () => {
    if (reloadRef.current) clearTimeout(reloadRef.current);
    if (warmupReloadRef.current) clearTimeout(warmupReloadRef.current);
    if (codexOauthPollRef.current) clearInterval(codexOauthPollRef.current);
    if (codexOauthStateRef.current) {
      stopCodexOAuth(codexOauthStateRef.current).catch(() => {});
    }
    codexOauthPopupRef.current?.close();
  }, []);

  useEffect(() => {
    const pollId = codexOauthPollRef.current;
    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, []);

  useWsEvent(["auto_warmup_status"], (msg) => {
    setAutoWarmup(msg.data);
  });

  useWsEvent([
    "warmup_queue_added", "warmup_processing",
    "warmup_complete", "warmup_success", "warmup_exhausted",
    "warmup_auth_error", "warmup_transient_error",
    "warmup_unsupported", "warmup_queue_cleared"
  ], scheduleWarmupReload);

  useWsEvent(["account_status"], scheduleReload);

  useWsEvent(["byok_created", "byok_updated", "byok_deleted"], async () => {
    const byokRes = await fetchByokProviders();
    setByokProviders(byokRes.providers || []);
  });

  async function handleToggleAutoWarmup(provider: Provider) {
    const key = `auto_warmup_provider_${provider}`;
    const next = settingsMap[key] === "true" ? "false" : "true";
    setSettingsMap((current) => ({ ...current, [key]: next }));
    try {
      await updateSettings({ [key]: next });
      const status = await fetchAutoWarmupStatus();
      setAutoWarmup(status);
      showSuccess(`Auto WarmUp ${next === "true" ? "enabled" : "disabled"} for ${labelProvider(provider)}`);
    } catch (err) {
      setSettingsMap((current) => ({ ...current, [key]: next === "true" ? "false" : "true" }));
      showError(err);
    }
  }

  function autoWarmupEnabledFor(provider: Provider): boolean {
    return settingsMap[`auto_warmup_provider_${provider}`] === "true";
  }

  function countdownLabel(): string {
    if (!autoWarmup?.nextRunAt) return "—";
    const remaining = Math.max(0, new Date(autoWarmup.nextRunAt).getTime() - now);
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function showSuccess(text: string) {
    setMessage(text);
    setError(null);
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setMessage(null), 4000);
  }
  function showError(err: unknown) { setError(err instanceof Error ? err.message : String(err)); setMessage(null); }

  async function handleAdd() {
    if (!addDialogProvider) return;
    try {
      const payload: any = { email: addForm.email, password: addForm.password, provider: addDialogProvider, headless: addForm.headless, browserEngine: addForm.browserEngine };
      await createAccount(payload);
      showSuccess("Account added and bot login started.");
      setAddForm({ email: "", password: "", provider: "kiro", browserEngine: "camoufox", headless: false });
      setAddDialogProvider(null);
      await load();
      navigate("/bot-logs");
    } catch (err) { showError(err); }
  }

  async function handleInstantLogin() {
    if (!instantTokens.trim()) { showError(new Error("Paste refresh tokens (one per line)")); return; }
    const tokens = instantTokens.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (tokens.length === 0) { showError(new Error("No valid tokens found")); return; }

    try {
      const res = await fetchApi<{ success: number; failed: number; errors?: string[] }>("/api/accounts/instant-login", {
        method: "POST",
        body: JSON.stringify({ tokens, provider: addDialogProvider }),
      });
      showSuccess(`Instant login: ${res.success} success, ${res.failed} failed`);
      setInstantTokens("");
      setAddDialogProvider(null);
      await load();
    } catch (err) { showError(err); }
  }

  async function handleCookieLogin() {
    if (!cookieValue.trim()) { showError(new Error("Paste Personal Access Token (PAT)")); return; }
    try {
      const res = await fetchApi<any>("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          provider: "qoder",
          personalToken: cookieValue.trim(),
        }),
      });
      if (res.error) throw new Error(res.error);
      showSuccess("Qoder account added successfully");
      setCookieValue("");
      setAddDialogProvider(null);
      await load();
    } catch (err) { showError(err); }
  }

  async function handleBulkImport() {
    if (!addDialogProvider || !bulkText.trim()) { showError(new Error("Paste email|password lines")); return; }
    try {
      const opts: any = { headless: bulkHeadless, browserEngine: bulkBrowserEngine, concurrency: bulkConcurrency };
      const res = await importAccounts(bulkText, [addDialogProvider], opts) as any;
      showSuccess(res.message || "Bulk import queued.");
      setBulkText("");
      setAddDialogProvider(null);
      await load();
      navigate("/bot-logs");
    } catch (err) { showError(err); }
  }

  function clearCodexOAuthPolling() {
    if (codexOauthPollRef.current) {
      clearInterval(codexOauthPollRef.current);
      codexOauthPollRef.current = null;
    }
  }

  function resetCodexOAuthFlow() {
    clearCodexOAuthPolling();
    codexOauthPopupRef.current?.close();
    codexOauthPopupRef.current = null;
    codexOauthStateRef.current = null;
    setCodexOauthBusy(false);
    setCodexOauthAuthUrl("");
    setCodexOauthCallbackUrl("");
  }

  async function safeCopyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(successMessage);
    } catch (err) {
      showError(err);
    }
  }

  function isCodexCallbackUrlValid(value: string) {
    try {
      const url = new URL(value.trim());
      return !!url.searchParams.get("code") && !!url.searchParams.get("state");
    } catch {
      return false;
    }
  }

  const hasPreparedCodexOAuth = !!codexOauthStateRef.current && !!codexOauthAuthUrl;
  const codexCallbackReady = isCodexCallbackUrlValid(codexOauthCallbackUrl);
  const codexCallbackExample = "http://localhost:1455/auth/callback?code=...&state=...";
  const codexLoopbackUrl = "http://localhost:1455/auth/callback";

  async function startCodexOAuthSession() {
    const redirectUri = codexLoopbackUrl;
    const appPort = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    const auth = await getCodexAuthorize(redirectUri);
    await startCodexOAuthProxy({
      appPort,
      state: auth.state,
      codeVerifier: auth.codeVerifier,
      redirectUri: auth.redirectUri,
    });
    codexOauthStateRef.current = auth.state;
    setCodexOauthAuthUrl(auth.authUrl);
    setCodexOauthCallbackUrl("");
    return auth;
  }

  function finishCodexOAuthSuccess(status: Awaited<ReturnType<typeof pollCodexOAuthStatus>>) {
    resetCodexOAuthFlow();
    showSuccess(`Codex connected: ${status.connection?.displayName || status.connection?.email || "account added"}`);
    setAddDialogProvider(null);
    load();
  }

  function beginCodexOAuthPolling() {
    clearCodexOAuthPolling();
    codexOauthPollRef.current = setInterval(async () => {
      const state = codexOauthStateRef.current;
      if (!state) return;

      try {
        const status = await pollCodexOAuthStatus(state);
        if (status.status === "done") {
          finishCodexOAuthSuccess(status);
          return;
        }

        if (status.status === "error" || status.status === "cancelled" || status.status === "not_found" || status.status === "unknown") {
          resetCodexOAuthFlow();
          showError(new Error(status.error || "Codex OAuth failed"));
        }
      } catch (pollError) {
        resetCodexOAuthFlow();
        showError(pollError);
      }
    }, 1500);
  }

  async function handleCodexOAuthLogin() {
    if (codexOauthBusy) return;
    setCodexOauthBusy(true);
    setError(null);

    try {
      const auth = await startCodexOAuthSession();
      codexOauthPopupRef.current = window.open(auth.authUrl, "codex_oauth_popup", "width=640,height=800");
      if (!codexOauthPopupRef.current) {
        window.open(auth.authUrl, "_blank", "noopener,noreferrer");
      }
      beginCodexOAuthPolling();
    } catch (err) {
      resetCodexOAuthFlow();
      showError(err);
    }
  }

  async function handleCodexOAuthPrepareManual() {
    if (codexOauthBusy || hasPreparedCodexOAuth) return;
    setCodexOauthBusy(true);
    setError(null);

    try {
      await startCodexOAuthSession();
      beginCodexOAuthPolling();
      showSuccess("Auth URL ready. Open it, login, lalu paste callback URL di bawah.");
    } catch (err) {
      resetCodexOAuthFlow();
      showError(err);
    }
  }

  async function handleCodexOAuthSubmitManual() {
    if (codexOauthBusy || !codexCallbackReady) return;
    setCodexOauthBusy(true);
    setError(null);

    try {
      await completeCodexOAuthCallbackUrl(codexOauthCallbackUrl);
      const state = codexOauthStateRef.current;
      if (!state) {
        resetCodexOAuthFlow();
        showSuccess("Codex connected");
        setAddDialogProvider(null);
        await load();
        return;
      }
      const status = await pollCodexOAuthStatus(state);
      finishCodexOAuthSuccess(status);
    } catch (err) {
      setCodexOauthBusy(false);
      showError(err);
    }
  }

  async function handleCodexOAuthCopyAuthUrl() {
    if (!codexOauthAuthUrl) return;
    await safeCopyText(codexOauthAuthUrl, "Auth URL copied");
  }

  function handleCodexOAuthOpenManual() {
    if (!codexOauthAuthUrl) return;
    window.open(codexOauthAuthUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCodexOAuthPasteCallback() {
    try {
      const text = await navigator.clipboard.readText();
      setCodexOauthCallbackUrl(text);
    } catch (err) {
      showError(err);
    }
  }

  function handleOpenAddDialog(provider: Provider) {
    resetCodexOAuthFlow();
    if (provider === "codex") {
      setAddMode("pat");
    }
    setAddDialogProvider(provider);
  }

  function handleCloseAddDialog() {
    const state = codexOauthStateRef.current;
    resetCodexOAuthFlow();
    if (state) {
      stopCodexOAuth(state).catch(() => {});
    }
    setAddDialogProvider(null);
  }

  function handleSetCodexMode(mode: typeof addMode) {
    if (mode === addMode) return;
    const state = codexOauthStateRef.current;
    resetCodexOAuthFlow();
    if (state) {
      stopCodexOAuth(state).catch(() => {});
    }
    setAddMode(mode);
  }

  async function handleLoginAll() {
    setLoginPendingDialog(true);
  }

  async function confirmLoginAll() {
    setLoginPendingDialog(false);
    try {
      const res = await loginAllAccounts({ concurrency: loginPendingConcurrency }) as any;
      showSuccess(res.message || "Login all queued.");
      await load();
      navigate("/bot-logs");
    } catch (err) { showError(err); }
  }

  async function handleWarmupProvider(provider: Provider) {
    try {
      const res = await warmupAllAccounts({ providers: [provider], statuses: ["active", "exhausted", "error"] }) as any;
      showSuccess(res.message || `${labelProvider(provider)} WarmUp queued.`);
      await load();
    } catch (err) { showError(err); }
  }

  async function handleRetryErrors(provider: Provider) {
    const ids = accounts.filter((a) => a.provider === provider && a.status === "error").map((a) => a.id);
    if (ids.length === 0) return;
    await loginAccounts(ids);
    showSuccess(`Queued ${ids.length} ${labelProvider(provider)} error accounts for retry.`);
    await load();
  }

  async function handleAddByok() {
    if (!byokForm.label || !byokForm.base_url || !byokForm.api_key || !byokForm.models) {
      showError(new Error("All fields are required"));
      return;
    }

    const models = byokForm.models.split(",").map(m => m.trim()).filter(Boolean);
    if (models.length === 0) {
      showError(new Error("At least one model is required"));
      return;
    }

    try {
      await createByokProvider({
        label: byokForm.label,
        base_url: byokForm.base_url,
        api_key: byokForm.api_key,
        format: byokForm.format,
        models,
      });
      showSuccess(`BYOK provider "${byokForm.label}" created successfully`);
      setByokForm({ label: "", base_url: "", api_key: "", format: "auto", models: "" });
      setByokEditId(null);
      setByokDialogOpen(false);
      await load();
    } catch (err) {
      showError(err);
    }
  }

  async function handleUpdateByok() {
    if (byokEditId === null) return;
    if (!byokForm.base_url || !byokForm.models) {
      showError(new Error("Base URL and models are required"));
      return;
    }

    const models = byokForm.models.split(",").map(m => m.trim()).filter(Boolean);
    if (models.length === 0) {
      showError(new Error("At least one model is required"));
      return;
    }

    try {
      const updateData: any = {
        base_url: byokForm.base_url,
        format: byokForm.format,
        models,
      };

      if (byokForm.api_key && byokForm.api_key.trim() && byokForm.api_key !== BYOK_KEY_PLACEHOLDER) {
        updateData.api_key = byokForm.api_key;
      }

      await updateByokProvider(byokEditId, updateData);
      showSuccess(`BYOK provider "${byokForm.label}" updated successfully`);
      setByokForm({ label: "", base_url: "", api_key: "", format: "auto", models: "" });
      setByokEditId(null);
      setByokDialogOpen(false);
      await load();
    } catch (err) {
      showError(err);
    }
  }

  const BYOK_KEY_PLACEHOLDER = "••••••••";

  function handleEditByok(provider: ByokProvider) {
    setByokEditId(provider.id);
    setByokForm({
      label: provider.label,
      base_url: provider.base_url,
      api_key: BYOK_KEY_PLACEHOLDER,
      format: provider.format,
      models: provider.models.join(", "),
    });
    setByokDialogOpen(true);
  }

  function handleCloseByokDialog() {
    setByokForm({ label: "", base_url: "", api_key: "", format: "auto", models: "" });
    setByokEditId(null);
    setByokDialogOpen(false);
  }

  async function handleTestByok(id: number, label: string) {
    try {
      const result = await testByokProvider(id);
      if (result.success) {
        const latency = result.latency_ms ? ` · ${result.latency_ms}ms` : "";
        const fixed = result.auto_fixed ? " — auto-fixed to active!" : "";
        showSuccess(`✓ ${label} OK (format: ${result.format}, model: ${result.model}${latency})${fixed}`);
        if (result.auto_fixed) await load();
      } else {
        showError(new Error(result.error || "Connection test failed"));
      }
    } catch (err) {
      showError(err);
    }
  }

  async function handleTestByokModel(providerId: number, model: string) {
    const key = `${providerId}-${model}`;
    setByokTestResults(prev => new Map(prev).set(key, { status: 'testing' }));
    try {
      const result = await testByokProvider(providerId, model);
      setByokTestResults(prev => new Map(prev).set(key, {
        status: result.success ? 'success' : 'error',
        latencyMs: result.latency_ms,
        error: result.error,
      }));
      if (result.auto_fixed) {
        showSuccess(`✓ ${model} OK (${result.latency_ms}ms) — account auto-fixed to active`);
        await load();
      }
    } catch (err) {
      setByokTestResults(prev => new Map(prev).set(key, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  async function handleDeleteByok(id: number, label: string) {
    if (!confirm(`Delete BYOK provider "${label}"? This cannot be undone.`)) return;

    try {
      await deleteByokProvider(id);
      showSuccess(`BYOK provider "${label}" deleted`);
      await load();
    } catch (err) {
      showError(err);
    }
  }

  const providerStats = useMemo(() => {
    return providers.map((provider) => {
      const rows = accounts.filter((a) => a.provider === provider);
      const quotaLimit = rows.reduce((sum, a) => sum + (a.quotaLimit || 0), 0);
      const quotaRemaining = rows.reduce((sum, a) => sum + (a.quotaRemaining || 0), 0);
      return {
        provider,
        total: rows.length,
        active: rows.filter((a) => a.status === "active").length,
        exhausted: rows.filter((a) => a.status === "exhausted").length,
        pending: rows.filter((a) => a.status === "pending").length,
        error: rows.filter((a) => a.status === "error").length,
        credits: { used: Math.max(0, quotaLimit - quotaRemaining), total: quotaLimit, remaining: quotaRemaining },
      };
    });
  }, [accounts]);

  // Summary totals
  const totalAccounts = accounts.length;
  const totalActive = accounts.filter((a) => a.status === "active").length;
  const totalExhausted = accounts.filter((a) => a.status === "exhausted").length;
  const totalError = accounts.filter((a) => a.status === "error").length;
  const totalPending = accounts.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Accounts</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Manage provider accounts</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] hover:border-[var(--primary)]/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleLoginAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 hover:bg-[var(--primary)]/20 transition-all"
          >
            <Play className="w-3.5 h-3.5" /> Login Pending
          </button>
        </div>
      </div>

      {/* Messages */}
      {(message || error) && (
        <div className={`rounded-lg p-3 text-sm border ${message ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" : "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20"}`}>
          {message || error}
        </div>
      )}

      {/* Summary Bar */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--muted-foreground)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">{totalAccounts} accounts</span>
          </div>
          <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-[var(--success)]/10">
              <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
              <span className="text-[var(--success)] font-semibold">{totalActive}</span>
              <span className="text-[var(--success)]/80">Active</span>
            </span>
            {totalExhausted > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-[var(--warning)]/10">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                <span className="text-[var(--warning)] font-semibold">{totalExhausted}</span>
                <span className="text-[var(--warning)]/80">Exhausted</span>
              </span>
            )}
            {totalError > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-[var(--error)]/10">
                <span className="w-2 h-2 rounded-full bg-[var(--error)]" />
                <span className="text-[var(--error)] font-semibold">{totalError}</span>
                <span className="text-[var(--error)]/80">Error</span>
              </span>
            )}
            {totalPending > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-[var(--secondary)]">
                <span className="w-2 h-2 rounded-full bg-[var(--muted-foreground)]" />
                <span className="text-[var(--foreground)] font-semibold">{totalPending}</span>
                <span className="text-[var(--muted-foreground)]">Pending</span>
              </span>
            )}
          </div>
          {/* Queue status */}
          {(Number(queue?.active || 0) > 0 || Number(queue?.queued || 0) > 0) && (
            <>
              <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />
              <span className="text-xs text-[var(--info)]">
                <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                Login: {Number(queue?.active || 0)} running, {Number(queue?.queued || 0)} queued
              </span>
            </>
          )}
        </div>
      </div>

      {/* Provider Cards - 2x3 grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {providerStats.map((stat) => {
          const color = providerColors[stat.provider] || "#6b7280";
          const gradient = providerGradients[stat.provider] || "from-gray-500/10 to-gray-600/5";
          const quotaPercent = stat.credits.total > 0
            ? Math.round((stat.credits.remaining / stat.credits.total) * 100)
            : 0;
          const isWarmingUp = warmupProgress[stat.provider] && warmupProgress[stat.provider].completed < warmupProgress[stat.provider].total;

          return (
            <Card
              key={stat.provider}
              className="border-[var(--border)] group hover:border-[var(--primary)]/40 hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-200 cursor-pointer overflow-hidden"
              onClick={() => navigate(`/accounts/${stat.provider}`)}
            >
              <CardContent className="p-0">
                {/* Gradient header with icon */}
                <div className={`bg-gradient-to-r ${gradient} px-4 pt-4 pb-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-[var(--card)] shadow-sm border border-[var(--border)]/50">
                        <ProviderIcon provider={stat.provider} size={22} />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-[var(--foreground)]">{labelProvider(stat.provider)}</span>
                        <div className="text-[11px] text-[var(--muted-foreground)]">{stat.total} accounts</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                <div className="px-4 pb-4 pt-3 space-y-3">
                  {/* Status pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                      {stat.active} Active
                    </span>
                    {stat.exhausted > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />
                        {stat.exhausted} Exhausted
                      </span>
                    )}
                    {stat.error > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[var(--error)]/10 text-[var(--error)] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]" />
                        {stat.error} Error
                      </span>
                    )}
                    {stat.pending > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]" />
                        {stat.pending} Pending
                      </span>
                    )}
                  </div>

                  {/* Quota bar */}
                  {stat.credits.total > 0 && (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-[var(--secondary)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${quotaPercent}%`,
                            backgroundColor: quotaPercent < 20 ? "var(--error)" : quotaPercent < 50 ? "var(--warning)" : color,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                        <span>{stat.credits.remaining.toFixed(1)} remaining</span>
                        <span>{quotaPercent}%</span>
                      </div>
                    </div>
                  )}

                  {/* WarmUp progress */}
                  {isWarmingUp && (
                    <div className="flex items-center gap-2 text-[11px] text-[var(--info)] bg-[var(--info)]/5 rounded-md px-2 py-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Warmup {warmupProgress[stat.provider].completed}/{warmupProgress[stat.provider].total}</span>
                    </div>
                  )}

                  {/* Auto WarmUp + Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/50" onClick={(e) => e.stopPropagation()}>
                    {/* Auto warmup toggle */}
                    <div className="flex items-center gap-2">
                      <Flame className={`h-3.5 w-3.5 ${autoWarmupEnabledFor(stat.provider) ? "text-[var(--warning)]" : "text-[var(--muted-foreground)]"}`} />
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {autoWarmupEnabledFor(stat.provider)
                          ? autoWarmup?.nextRunAt ? countdownLabel() : "On"
                          : "Off"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleAutoWarmup(stat.provider)}
                        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                          autoWarmupEnabledFor(stat.provider) ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            autoWarmupEnabledFor(stat.provider) ? "translate-x-3.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Action buttons — pill style */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenAddDialog(stat.provider)}
                        title="Add account"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Add
                      </button>
                      <button
                        onClick={() => handleWarmupProvider(stat.provider)}
                        disabled={Boolean(warmupProgress[stat.provider])}
                        title="Warmup all"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--info)]/10 text-[var(--info)] hover:bg-[var(--info)]/20 transition-colors disabled:opacity-40"
                      >
                        <RefreshCw className="h-3 w-3" /> Warmup
                      </button>
                      {stat.error > 0 && (
                        <button
                          onClick={() => handleRetryErrors(stat.provider)}
                          title="Retry errors"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Retry
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* BYOK Providers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--primary)]/10">
              <ProviderIcon provider="byok" size={18} />
            </div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Custom Providers (BYOK)</h2>
            <Badge variant="secondary" className="text-[10px]">{byokProviders.length}</Badge>
          </div>
          <button
            onClick={() => setByokDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 border border-[var(--primary)]/20 transition-all hover:shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Add Provider
          </button>
        </div>

        {byokProviders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
            <Shield className="h-8 w-8 text-[var(--muted-foreground)] mx-auto mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">No custom providers yet</p>
            <Button size="sm" variant="outline" onClick={() => setByokDialogOpen(true)} className="mt-3 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Provider
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byokProviders.map((provider) => (
              <Card key={provider.id} className="border-[var(--border)] hover:border-[var(--primary)]/40 transition-all">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${provider.status === "active" ? "bg-[var(--success)]" : "bg-[var(--warning)]"}`} />
                      <span className="text-sm font-semibold text-[var(--foreground)]">{provider.label}</span>
                    </div>
                    <Badge
                      variant={provider.status === "active" ? "success" : "warning"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {provider.status}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">{provider.base_url}</p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-[var(--muted-foreground)]">{provider.format}</span>
                      <span className="text-[var(--muted-foreground)]">·</span>
                      <span className="text-[var(--foreground)]">{provider.models.length} models</span>
                    </div>
                  </div>

                  {/* Models preview */}
                  <div className="flex flex-wrap gap-1">
                    {provider.models.slice(0, 3).map((model) => (
                      <Badge key={model} variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                        {model}
                      </Badge>
                    ))}
                    {provider.models.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{provider.models.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Actions — pill buttons */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--border)]/50">
                    <button
                      onClick={() => handleEditByok(provider)}
                      className="inline-flex items-center gap-1 flex-1 justify-center px-2 py-1 rounded-full text-[11px] font-medium bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--secondary)]/80 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleTestByok(provider.id, provider.label)}
                      className="inline-flex items-center gap-1 flex-1 justify-center px-2 py-1 rounded-full text-[11px] font-medium bg-[var(--info)]/10 text-[var(--info)] hover:bg-[var(--info)]/20 transition-colors"
                    >
                      <Zap className="h-3 w-3" /> Test
                    </button>
                    <button
                      onClick={() => handleDeleteByok(provider.id, provider.label)}
                      className="inline-flex items-center gap-1 flex-1 justify-center px-2 py-1 rounded-full text-[11px] font-medium bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Del
                    </button>
                  </div>

                  {/* Expandable test section */}
                  {expandedByokId === provider.id && (
                    <div className="border-t border-[var(--border)] pt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-3.5 w-3.5 text-[var(--info)]" />
                        <span className="text-xs font-medium">Test Models</span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {provider.models.map((model) => {
                          const key = `${provider.id}-${model}`;
                          const result = byokTestResults.get(key);
                          return (
                            <div key={model} className="flex items-center justify-between p-2 rounded bg-[var(--secondary)]/50 text-xs">
                              <span className="font-mono text-[var(--foreground)]">{model}</span>
                              <div className="flex items-center gap-2">
                                {result?.status === 'testing' && <Loader2 className="h-3 w-3 animate-spin text-[var(--primary)]" />}
                                {result?.status === 'success' && <span className="text-[var(--success)]">✓ {result.latencyMs}ms</span>}
                                {result?.status === 'error' && <span className="text-[var(--error)]">✗</span>}
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" disabled={result?.status === 'testing'} onClick={() => handleTestByokModel(provider.id, model)}>
                                  Test
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Toggle expand */}
                  <button
                    onClick={() => setExpandedByokId(expandedByokId === provider.id ? null : provider.id)}
                    className="w-full text-center text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {expandedByokId === provider.id ? "Hide tests ▲" : "Test models ▼"}
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* BYOK Add/Edit Dialog */}
      <Dialog open={byokDialogOpen} onOpenChange={(open) => !open && handleCloseByokDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <Key className="h-4.5 w-4.5" />
              </div>
              <div>
                <DTitle>{byokEditId ? 'Edit Custom Provider' : 'Add Custom Provider'}</DTitle>
                <DialogDescription className="mt-0.5">
                  {byokEditId ? 'Update your AI provider configuration' : 'Configure your own AI provider with your API key'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/[0.06] p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Connection</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">Provider Name</label>
                <Input
                  value={byokForm.label}
                  onChange={(e) => setByokForm({ ...byokForm, label: e.target.value })}
                  placeholder="e.g., openrouter, myprovider"
                  readOnly={byokEditId !== null}
                  className={`focus:ring-1 focus:ring-[var(--ring)] ${byokEditId ? 'bg-[var(--muted)] opacity-60' : ''}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">Base URL</label>
                <Input
                  value={byokForm.base_url}
                  onChange={(e) => setByokForm({ ...byokForm, base_url: e.target.value })}
                  placeholder="https://api.provider.com/v1"
                  className="focus:ring-1 focus:ring-[var(--ring)]"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/[0.06] p-3.5">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Authentication</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">API Key</label>
                <Input
                  type="password"
                  value={byokForm.api_key}
                  onChange={(e) => setByokForm({ ...byokForm, api_key: e.target.value })}
                  onFocus={() => {
                    if (byokEditId && byokForm.api_key === BYOK_KEY_PLACEHOLDER) {
                      setByokForm({ ...byokForm, api_key: "" });
                    }
                  }}
                  placeholder={byokEditId ? 'Enter new key to replace, or leave blank' : 'sk-...'}
                  className="focus:ring-1 focus:ring-[var(--ring)]"
                />
                {byokEditId && <p className="text-xs text-[var(--muted-foreground)]">Leave blank to keep existing key</p>}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/[0.06] p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Configuration</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">API Format</label>
                <select
                  value={byokForm.format}
                  onChange={(e) => setByokForm({ ...byokForm, format: e.target.value as any })}
                  className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="openai">OpenAI-compatible</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">Models</label>
                <textarea
                  value={byokForm.models}
                  onChange={(e) => setByokForm({ ...byokForm, models: e.target.value })}
                  placeholder="gpt-4, claude-3-opus, llama-3"
                  className="w-full h-20 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
                />
                <p className="text-xs text-[var(--muted-foreground)]">Comma-separated list of model IDs</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleCloseByokDialog}>Cancel</Button>
              <Button onClick={byokEditId ? handleUpdateByok : handleAddByok} className="gap-2">
                {byokEditId ? <><Pencil className="h-4 w-4" /> Update</> : <><Plus className="h-4 w-4" /> Add</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Login Pending Dialog */}
      <Dialog open={loginPendingDialog} onOpenChange={setLoginPendingDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DTitle>Login Pending Accounts</DTitle>
            <DialogDescription>Choose how many accounts to login concurrently.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <label className="text-sm text-[var(--muted-foreground)]">Concurrent:</label>
              <select value={loginPendingConcurrency} onChange={(e) => setLoginPendingConcurrency(Number(e.target.value))} className="h-8 w-20 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setLoginPendingDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={confirmLoginAll}>
                <Play className="w-4 h-4 mr-2" /> Start Login
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Account Dialog (per-provider) */}
      <Dialog open={addDialogProvider !== null} onOpenChange={(open) => {
        if (open) return;
        handleCloseAddDialog();
      }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DTitle>Add {addDialogProvider ? labelProvider(addDialogProvider) : ""} Account</DTitle>
            <DialogDescription>
              {addDialogProvider === "kiro-pro" || addDialogProvider === "codex"
                ? "Add via browser login or instant login with API key/token."
                : addDialogProvider === "qoder"
                ? "Add via PAT, bulk Google accounts, or single account."
                : `Add account for ${addDialogProvider ? labelProvider(addDialogProvider) : "this provider"}.`}
            </DialogDescription>
          </DialogHeader>

          {/* Mode tabs */}
          {addDialogProvider === "kiro-pro" || addDialogProvider === "codex" ? (
            <div className="flex gap-1 rounded-md bg-[var(--secondary)] p-1">
              <button onClick={() => setAddMode("instant")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "instant" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >Instant Login (Token)</button>
              {addDialogProvider === "codex" && <button onClick={() => handleSetCodexMode("pat")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "pat" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >OAuth Login</button>}
              <button onClick={() => addDialogProvider === "codex" ? handleSetCodexMode("bulk") : setAddMode("bulk")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "bulk" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >Bulk (Email|Pass)</button>
              <button onClick={() => addDialogProvider === "codex" ? handleSetCodexMode("single") : setAddMode("single")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "single" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >Single</button>
            </div>
          ) : addDialogProvider === "qoder" ? (
            <div className="flex gap-1 rounded-md bg-[var(--secondary)] p-1">
              <button onClick={() => setAddMode("pat")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "pat" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >PAT (Token)</button>
              <button onClick={() => setAddMode("bulk")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "bulk" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >Bulk (Email|Pass)</button>
              <button onClick={() => setAddMode("single")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "single" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >Single</button>
            </div>
          ) : (
            <div className="flex gap-1 rounded-md bg-[var(--secondary)] p-1">
              <button onClick={() => setAddMode("bulk")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "bulk" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >Bulk (Email|Pass)</button>
              <button onClick={() => setAddMode("single")}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${addMode === "single" ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >Single</button>
            </div>
          )}

          {/* Token / OAuth mode */}
          {addMode === "pat" && addDialogProvider === "qoder" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--foreground)]">Personal Access Token (PAT)</label>
                <textarea
                  value={cookieValue}
                  onChange={(e) => setCookieValue(e.target.value)}
                  className="mt-1 w-full h-40 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
                  placeholder="qd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialogProvider(null)}>Cancel</Button>
                <Button onClick={handleCookieLogin}>Add Account</Button>
              </div>
            </div>
          )}

          {addMode === "pat" && addDialogProvider === "codex" && (
            <div className="space-y-3">
              <div className="rounded-md border border-[var(--border)] bg-[var(--secondary)]/30 p-3 text-sm text-[var(--muted-foreground)]">
                Login Codex via popup OpenAI atau mode manual.
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="sm" onClick={handleCodexOAuthPrepareManual} disabled={codexOauthBusy || hasPreparedCodexOAuth}>
                  {hasPreparedCodexOAuth ? "Manual Ready" : codexOauthBusy ? "Preparing..." : "Prepare Manual"}
                </Button>
                <Button size="sm" onClick={handleCodexOAuthLogin} disabled={codexOauthBusy || hasPreparedCodexOAuth}>
                  {codexOauthBusy ? "Waiting for OAuth..." : "Start OAuth Login"}
                </Button>
              </div>

              {hasPreparedCodexOAuth && (
                <div className="space-y-3 rounded-md border border-[var(--border)] p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm text-[var(--foreground)]">Auth URL</label>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleCodexOAuthCopyAuthUrl}>Copy</Button>
                        <Button size="sm" variant="outline" onClick={handleCodexOAuthOpenManual}>Open</Button>
                      </div>
                    </div>
                    <textarea
                      value={codexOauthAuthUrl}
                      readOnly
                      className="w-full h-20 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-xs font-mono text-[var(--foreground)] focus:outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm text-[var(--foreground)]">Callback URL</label>
                      <Button size="sm" variant="outline" onClick={handleCodexOAuthPasteCallback} disabled={codexOauthBusy}>Paste</Button>
                    </div>
                    <textarea
                      value={codexOauthCallbackUrl}
                      onChange={(e) => setCodexOauthCallbackUrl(e.target.value)}
                      className="w-full h-20 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-xs font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
                      placeholder={codexCallbackExample}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleCodexOAuthSubmitManual} disabled={codexOauthBusy || !codexCallbackReady}>
                        Submit Callback URL
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={handleCloseAddDialog} disabled={codexOauthBusy && !hasPreparedCodexOAuth}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Instant Login mode */}
          {addMode === "instant" && (addDialogProvider === "kiro-pro" || addDialogProvider === "codex") && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--foreground)]">Refresh Tokens (one per line)</label>
                <textarea
                  value={instantTokens}
                  onChange={(e) => setInstantTokens(e.target.value)}
                  className="mt-1 w-full h-40 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
                  placeholder={"eyJhbGciOiJSUzI1NiIs...\neyJhbGciOiJSUzI1NiIs..."}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialogProvider(null)}>Cancel</Button>
                <Button onClick={handleInstantLogin}>Login Instant</Button>
              </div>
            </div>
          )}

          {/* Bulk mode */}
          {addMode === "bulk" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--foreground)]">Accounts (email|password per line)</label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="mt-1 w-full h-40 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
                  placeholder={"email@example.com|password123\nanother@example.com|pass456"}
                />
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <select value={bulkBrowserEngine} onChange={(e) => setBulkBrowserEngine(e.target.value)} className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]">
                  <option value="camoufox">Camoufox</option>
                  <option value="chromium">Chromium</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs text-[var(--foreground)]">
                  <input type="checkbox" checked={bulkHeadless} onChange={(e) => setBulkHeadless(e.target.checked)} className="h-3.5 w-3.5 rounded border-[var(--border)]" />
                  Headless
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--muted-foreground)]">×</span>
                  <select value={bulkConcurrency} onChange={(e) => setBulkConcurrency(Number(e.target.value))} className="h-8 w-14 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]">
                    {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialogProvider(null)}>Cancel</Button>
                <Button onClick={handleBulkImport}>Import & Login</Button>
              </div>
            </div>
          )}

          {/* Single mode */}
          {addMode === "single" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[var(--foreground)]">Email</label>
                <Input value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="email@example.com" className="mt-1" />
              </div>
              <div>
                <label className="text-sm text-[var(--foreground)]">Password</label>
                <Input value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} type="password" placeholder="********" className="mt-1" />
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <select value={addForm.browserEngine} onChange={(e) => setAddForm({ ...addForm, browserEngine: e.target.value })} className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]">
                  <option value="camoufox">Camoufox</option>
                  <option value="chromium">Chromium</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs text-[var(--foreground)]">
                  <input type="checkbox" checked={addForm.headless} onChange={(e) => setAddForm({ ...addForm, headless: e.target.checked })} className="h-3.5 w-3.5 rounded border-[var(--border)]" />
                  Headless
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialogProvider(null)}>Cancel</Button>
                <Button onClick={handleAdd}>Add Account</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

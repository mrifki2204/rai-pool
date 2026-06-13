import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Save, RefreshCw, Zap, Flame, Globe, Settings2, Clock, Lock } from "lucide-react";
import {
  fetchSettings,
  updateSettings,
  fetchProviderList,
  fetchAutoWarmupStatus,
  changePassword,
  type AutoWarmupStatus,
} from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useTimedMessage } from "@/hooks/useTimedMessage";

const PROVIDER_LABELS: Record<string, string> = {
  kiro: "Kiro",
  "kiro-pro": "Kiro Pro",
  codebuddy: "CodeBuddy",
  canva: "Canva",
};

function labelFor(provider: string): string {
  if (PROVIDER_LABELS[provider]) return PROVIDER_LABELS[provider]!;
  return provider.split("-").map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p)).join(" ");
}

export default function Settings() {
  const [form, setForm] = useState<Record<string, string>>({
    load_balancing_method: "round_robin",
    auto_warmup_interval_minutes: "15",
    proxy_pool_usage: "all",
    proxy_pool_rotation: "round_robin",
  });
  const [warmupStatus, setWarmupStatus] = useState<AutoWarmupStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { message, setMessage } = useTimedMessage<string>(null, 3000);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const providerListApi = useApi<{ data: string[] }>(fetchProviderList, []);
  const providers = useMemo(() => providerListApi.data?.data || [], [providerListApi.data]);

  async function load() {
    const res = (await fetchSettings()) as { data: Record<string, string> };
    setForm((current) => ({ ...current, ...(res.data || {}) }));
    setDirty(false);
    fetchAutoWarmupStatus().then(setWarmupStatus).catch(() => {});
  }

  useEffect(() => { load().catch(() => {}); }, []);

  function setValue(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function lbMethodFor(provider: string): string {
    return form[`provider_${provider}_lb_method`] || form.load_balancing_method || "round_robin";
  }

  function isOverride(provider: string): boolean {
    return Boolean(form[`provider_${provider}_lb_method`]);
  }

  async function save() {
    setSaving(true);
    try {
      await updateSettings(form);
      setDirty(false);
      setMessage("Settings saved");
    } finally { setSaving(false); }
  }

  const globalMethod = form.load_balancing_method || "round_robin";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--info)]/10 border border-[var(--primary)]/20">
            <Settings2 className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Proxy Settings</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Load balancing, warmup, and proxy pool configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-[10px] text-[var(--warning)] px-2 py-1 rounded-full bg-[var(--warning)]/10 font-medium">
              Unsaved changes
            </span>
          )}
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
          <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-all disabled:opacity-40">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20 p-3 text-sm text-[var(--success)]">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Load Balancing */}
        <Card className="border-[var(--border)] overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-[var(--primary)] to-emerald-500" />
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[var(--primary)]/15 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-[var(--primary)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Load Balancing</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Global Method</label>
              <select
                value={form.load_balancing_method || "round_robin"}
                onChange={(e) => setValue("load_balancing_method", e.target.value)}
                className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)]/50 focus:outline-none"
              >
                <option value="round_robin">Round Robin</option>
                <option value="sequential">Sequential</option>
              </select>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {globalMethod === "sequential" ? "Uses accounts in order, moves to next when exhausted." : "Distributes requests evenly across active accounts."}
              </p>
            </div>

            {providers.length > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Per-Provider Override</label>
                <div className="space-y-1.5">
                  {providers.map((provider) => {
                    const key = `provider_${provider}_lb_method`;
                    const overriden = isOverride(provider);
                    return (
                      <div key={provider} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--secondary)]/50 border border-[var(--border)]/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--foreground)]">{labelFor(provider)}</span>
                          {overriden && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] font-medium">override</span>}
                        </div>
                        <select
                          value={form[key] || ""}
                          onChange={(e) => setValue(key, e.target.value)}
                          className="h-7 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] text-[var(--foreground)]"
                        >
                          <option value="">Inherit</option>
                          <option value="round_robin">Round Robin</option>
                          <option value="sequential">Sequential</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto WarmUp */}
        <Card className="border-[var(--border)] overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Auto WarmUp</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Interval (minutes)</label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={form.auto_warmup_interval_minutes || ""}
                onChange={(e) => setValue("auto_warmup_interval_minutes", e.target.value)}
                placeholder="15"
                className="h-9"
              />
            </div>

            {/* Status */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wide">Status</span>
                {warmupStatus?.nextRunAt && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                    <Clock className="w-3 h-3" />
                    Next: {new Date(warmupStatus.nextRunAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {warmupStatus && warmupStatus.enabledProviders.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {warmupStatus.enabledProviders.map((p) => (
                    <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)] font-medium">
                      {labelFor(p)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--muted-foreground)]">No providers enabled</p>
              )}
            </div>

            <p className="text-[11px] text-[var(--muted-foreground)]">
              Enable/disable per provider on the Accounts page. Checks active, exhausted, and error accounts.
            </p>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="border-[var(--border)] overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-rose-500 to-pink-500" />
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-rose-500/15 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Change Password</h3>
            </div>

            {pwMessage && (
              <div className={`rounded-lg p-2.5 text-xs border ${pwMessage.type === "success" ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" : "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20"}`}>
                {pwMessage.text}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setPwMessage(null); }}
                  placeholder="Enter current password"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPwMessage(null); }}
                  placeholder="Enter new password"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPwMessage(null); }}
                  placeholder="Confirm new password"
                  className="h-9"
                />
              </div>
            </div>

            <button
              onClick={async () => {
                if (!currentPassword || !newPassword || !confirmPassword) {
                  setPwMessage({ type: "error", text: "All fields are required" });
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPwMessage({ type: "error", text: "New passwords do not match" });
                  return;
                }
                if (newPassword.length < 4) {
                  setPwMessage({ type: "error", text: "Password must be at least 4 characters" });
                  return;
                }
                setPwSaving(true);
                const result = await changePassword(currentPassword, newPassword);
                if (result.success) {
                  setPwMessage({ type: "success", text: "Password changed successfully" });
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                } else {
                  setPwMessage({ type: "error", text: result.error || "Failed to change password" });
                }
                setPwSaving(false);
              }}
              disabled={pwSaving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-500 text-white hover:bg-rose-600 transition-all disabled:opacity-40"
            >
              <Lock className="w-3.5 h-3.5" />
              {pwSaving ? "Changing..." : "Change Password"}
            </button>
          </CardContent>
        </Card>

        {/* Proxy Pool Settings */}
        <Card className="border-[var(--border)] overflow-hidden lg:col-span-2">
          <div className="h-0.5 bg-gradient-to-r from-[var(--info)] to-violet-500" />
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[var(--info)]/15 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-[var(--info)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Proxy Pool</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Usage Scope</label>
                <select
                  value={form.proxy_pool_usage || "all"}
                  onChange={(e) => setValue("proxy_pool_usage", e.target.value)}
                  className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)]/50 focus:outline-none"
                >
                  <option value="all">All — Model + Auth</option>
                  <option value="model">Model Only</option>
                  <option value="auth">Auth Only</option>
                </select>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {form.proxy_pool_usage === "model" ? "Proxies for API calls only." : form.proxy_pool_usage === "auth" ? "Proxies for login only." : "Proxies for both API and login."}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Rotation Strategy</label>
                <select
                  value={form.proxy_pool_rotation || "round_robin"}
                  onChange={(e) => setValue("proxy_pool_rotation", e.target.value)}
                  className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)]/50 focus:outline-none"
                >
                  <option value="round_robin">Round Robin</option>
                  <option value="sequential">Sequential</option>
                </select>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {form.proxy_pool_rotation === "sequential" ? "One proxy until fail, then next." : "Evenly distributed across proxies."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, Plus, Trash2, Power, PowerOff, Pencil, X, Shield, Code, ArrowRight } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { useWsEvent } from "@/hooks/useWebSocket";

interface FilterRule {
  id: number;
  ruleId: string;
  pattern: string;
  replacement: string;
  isActive: boolean;
  isRegex: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

interface FilterListResponse {
  count: number;
  activeCount: number;
  rules: FilterRule[];
}

interface RuleFormState {
  id: number | null;
  pattern: string;
  replacement: string;
  isRegex: boolean;
  isActive: boolean;
}

const emptyForm: RuleFormState = { id: null, pattern: "", replacement: "", isRegex: true, isActive: true };

export default function FilterRules() {
  const [data, setData] = useState<FilterListResponse>({ count: 0, activeCount: 0, rules: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RuleFormState | null>(null);
  const { message, setMessage } = useTimedMessage<string>(null, 3000);

  const load = useCallback(async () => {
    try {
      const result = await fetchApi<FilterListResponse>("/api/filters");
      setData(result);
    } catch {
      setData({ count: 0, activeCount: 0, rules: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useWsEvent(["filter_rules_updated"], load);

  const handleToggle = async (rule: FilterRule) => {
    try {
      await fetchApi(`/api/filters/${rule.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !rule.isActive }) });
      load();
    } catch (e: any) { setMessage(e.message || "Failed"); }
  };

  const handleDelete = async (rule: FilterRule) => {
    if (!confirm(`Delete rule "${rule.ruleId}"?`)) return;
    try {
      await fetchApi(`/api/filters/${rule.id}`, { method: "DELETE" });
      setMessage("Rule deleted");
      load();
    } catch (e: any) { setMessage(e.message || "Failed"); }
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.pattern.trim()) { setMessage("Pattern is required"); return; }
    try {
      if (form.id == null) {
        await fetchApi("/api/filters", { method: "POST", body: JSON.stringify({ pattern: form.pattern, replacement: form.replacement, isRegex: form.isRegex, isActive: form.isActive }) });
        setMessage("Rule created");
      } else {
        await fetchApi(`/api/filters/${form.id}`, { method: "PATCH", body: JSON.stringify({ pattern: form.pattern, replacement: form.replacement, isRegex: form.isRegex, isActive: form.isActive }) });
        setMessage("Rule updated");
      }
      setForm(null);
      load();
    } catch (e: any) { setMessage(e.message || "Save failed"); }
  };

  const truncate = (s: string, n = 50) => (s.length > n ? `${s.slice(0, n)}…` : s);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-[var(--primary)]/10 border border-violet-500/20">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Filter Rules</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Sanitize requests before sending to upstream providers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)] px-2 py-1 rounded-full bg-[var(--secondary)]">
            {data.activeCount}/{data.count} active
          </span>
          <button onClick={() => setForm({ ...emptyForm })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 hover:bg-[var(--primary)]/20 transition-all">
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="px-4 py-2.5 rounded-lg bg-[var(--secondary)] text-sm text-[var(--foreground)] border border-[var(--border)]">
          {message}
        </div>
      )}

      {/* Form */}
      {form && (
        <Card className="border-[var(--border)] overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-violet-500 to-[var(--primary)]" />
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <Code className="w-4 h-4 text-violet-400" />
                {form.id == null ? "New Rule" : "Edit Rule"}
              </h3>
              <button onClick={() => setForm(null)} className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Pattern</label>
                <textarea
                  className="w-full h-[70px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                  placeholder={form.isRegex ? "regex pattern (case-insensitive)" : "exact string to match"}
                  value={form.pattern}
                  onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Replacement</label>
                <textarea
                  className="w-full h-[70px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                  placeholder="(empty = remove matched text)"
                  value={form.replacement}
                  onChange={(e) => setForm({ ...form, replacement: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.isRegex} onChange={(e) => setForm({ ...form, isRegex: e.target.checked })} className="rounded" />
                  Regex
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                  Active
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-all">
                  {form.id == null ? "Create" : "Update"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      <Card className="border-[var(--border)]">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">Loading...</div>
          ) : data.rules.length === 0 ? (
            <div className="p-8 text-center">
              <Filter className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-2" />
              <p className="text-sm text-[var(--muted-foreground)]">No filter rules</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Add rules to sanitize request content before upstream</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {data.rules.map((rule) => (
                <div key={rule.id} className={`px-4 py-3 hover:bg-[var(--secondary)]/30 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    {/* Status + info */}
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${rule.isActive ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"}`} />
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Pattern → Replacement */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-[var(--foreground)] bg-[var(--secondary)] px-2 py-0.5 rounded max-w-[300px] truncate" title={rule.pattern}>
                          {truncate(rule.pattern)}
                        </span>
                        {rule.replacement ? (
                          <>
                            <ArrowRight className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                            <span className="text-xs font-mono text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded max-w-[200px] truncate" title={rule.replacement}>
                              {truncate(rule.replacement, 30)}
                            </span>
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                            <span className="text-[10px] text-[var(--error)] italic">remove</span>
                          </>
                        )}
                      </div>
                      {/* Meta */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${rule.isRegex ? "bg-[var(--info)]/10 text-[var(--info)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>
                          {rule.isRegex ? "regex" : "string"}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">#{rule.sortOrder}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{rule.ruleId}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => handleToggle(rule)} className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors" title={rule.isActive ? "Disable" : "Enable"}>
                        {rule.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setForm({ id: rule.id, pattern: rule.pattern, replacement: rule.replacement, isRegex: rule.isRegex, isActive: rule.isActive })} className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(rule)} className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

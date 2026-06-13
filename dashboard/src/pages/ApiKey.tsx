import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Eye, EyeOff, RefreshCw, Check, Save, ShieldCheck, Key, Zap, TestTube, Terminal } from "lucide-react";
import { fetchApiKey, regenerateApiKey, setApiKey, testApiKey, API_BASE } from "@/lib/api";
import { useTimedMessage } from "@/hooks/useTimedMessage";

export default function ApiKey() {
  const [apiKey, setApiKeyState] = useState("");
  const [source, setSource] = useState("browser");
  const [showKey, setShowKey] = useState(false);
  const { message, setMessage: setTimedMessage, clearMessage } = useTimedMessage<string>(null, 3500);
  const { message: copied, setMessage: setCopiedTimed } = useTimedMessage<boolean>(null, 2000);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  function notify(text: string) {
    setTimedMessage(text);
    setError(null);
  }

  function fail(err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
    clearMessage();
  }

  function saveToBrowser(key = apiKey) {
    setApiKeyState(key);
  }

  async function loadKey() {
    try {
      const res = await fetchApiKey() as { key: string; source: string };
      setApiKeyState(res.key);
      setSource(res.source);
      saveToBrowser(res.key);
      setValid(true);
    } catch (err) {
      fail(err);
    }
  }

  useEffect(() => { loadKey(); }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedTimed(true);
  };

  async function handleSave() {
    try {
      const res = await setApiKey(apiKey) as { key: string; source: string };
      saveToBrowser(res.key);
      setSource(res.source);
      setValid(true);
      notify("API key saved and activated.");
    } catch (err) { fail(err); }
  }

  async function handleRegenerate() {
    if (!confirm("Generate a new API key? The current key will stop working.")) return;
    try {
      const res = await regenerateApiKey() as { key: string; source: string };
      saveToBrowser(res.key);
      setSource(res.source);
      setValid(true);
      notify("New API key generated and activated.");
    } catch (err) { fail(err); }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await testApiKey(apiKey) as { valid: boolean };
      setValid(res.valid);
      notify(res.valid ? "API key is valid ✓" : "API key is invalid ✗");
    } catch (err) { fail(err); }
    finally { setTesting(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--primary)]/20 to-amber-500/10 border border-[var(--primary)]/20">
          <Key className="w-5 h-5 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">API Key</h1>
          <p className="text-xs text-[var(--muted-foreground)]">Manage your proxy authentication key</p>
        </div>
      </div>

      {/* Status message */}
      {(message || error) && (
        <div className={`rounded-lg p-3 text-sm border ${message ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20" : "bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20"}`}>
          {message || error}
        </div>
      )}

      {/* Key Card */}
      <Card className="border-[var(--border)] overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-[var(--primary)] to-amber-500" />
        <CardContent className="p-5 space-y-5">
          {/* Key input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Active Key</label>
              <div className="flex items-center gap-2">
                {valid === true && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" /> Valid
                  </span>
                )}
                {valid === false && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--error)]/10 text-[var(--error)]">
                    Invalid
                  </span>
                )}
                <span className="text-[10px] text-[var(--muted-foreground)] px-2 py-0.5 rounded-full bg-[var(--secondary)]">
                  {source}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => { setApiKeyState(e.target.value); setValid(null); }}
                  className="pr-10 font-mono text-sm h-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={handleCopy}
                className="h-10 w-10 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
                title="Copy"
              >
                {copied ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4 text-[var(--muted-foreground)]" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--info)]/10 to-[var(--info)]/5 border border-[var(--info)]/20 text-[var(--info)] hover:from-[var(--info)]/20 hover:to-[var(--info)]/10 transition-all disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <TestTube className="w-5 h-5" />}
              <span className="text-[11px] font-semibold">Test</span>
            </button>
            <button
              onClick={handleRegenerate}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-amber-500/10 to-amber-500/5 border border-amber-500/20 text-amber-500 hover:from-amber-500/20 hover:to-amber-500/10 transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-[11px] font-semibold">Generate</span>
            </button>
            <button
              onClick={handleSave}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--primary)]/15 to-[var(--primary)]/5 border border-[var(--primary)]/30 text-[var(--primary)] hover:from-[var(--primary)]/25 hover:to-[var(--primary)]/10 transition-all"
            >
              <Save className="w-5 h-5" />
              <span className="text-[11px] font-semibold">Save</span>
            </button>
            <button
              onClick={loadKey}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-b from-[var(--secondary)] to-[var(--secondary)]/50 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all"
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[11px] font-semibold">Load Active</span>
            </button>
          </div>

          {/* Usage */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--secondary)]/30 border-b border-[var(--border)]">
              <Terminal className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">Usage Example</span>
            </div>
            <pre className="px-4 py-3 text-[11px] font-mono text-[var(--foreground)] overflow-x-auto leading-relaxed">
{`curl ${API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ${showKey ? apiKey : "••••••••"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "cb-opus-4.8",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
            </pre>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-[var(--secondary)]/30 border border-[var(--border)]/50">
            <Zap className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
              This key authenticates all requests to the proxy. Use it as <code className="bg-[var(--background)] px-1 rounded">Bearer</code> token or <code className="bg-[var(--background)] px-1 rounded">x-api-key</code> header. The <code className="bg-[var(--background)] px-1 rounded">.env</code> fallback key is always accepted.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Plus, Trash2, Upload, RefreshCw, Power, PowerOff, Download, Search, Shield, Wifi, WifiOff } from "lucide-react";
import { fetchApi, fetchProxyCountries, scrapeProxies, type ProxyCountry } from "@/lib/api";
import { useTimedMessage } from "@/hooks/useTimedMessage";

interface ProxyEntry {
  id: number;
  url: string;
  type: string;
  label: string | null;
  status: string;
  lastUsedAt: string | null;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  successCount: number;
  failCount: number;
  createdAt: string;
}

interface ProxyPoolStatus {
  count: number;
  activeCount: number;
  proxies: ProxyEntry[];
}

export default function ProxyPool() {
  const [pool, setPool] = useState<ProxyPoolStatus>({ count: 0, activeCount: 0, proxies: [] });
  const [loading, setLoading] = useState(true);
  const [bulkText, setBulkText] = useState("");
  const [checking, setChecking] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showScrape, setShowScrape] = useState(false);
  const { message, setMessage } = useTimedMessage<string>(null, 3000);

  // Scrape controls
  const [countries, setCountries] = useState<ProxyCountry[]>([]);
  const [scrapeSource, setScrapeSource] = useState<"all" | "proxyscrape" | "geonode" | "proxifly">("all");
  const [scrapeCountry, setScrapeCountry] = useState("all");
  const [scrapeProtocol, setScrapeProtocol] = useState<"all" | "http" | "socks5">("all");
  const [scrapeLimit, setScrapeLimit] = useState(50);
  const [scrapeVerify, setScrapeVerify] = useState(true);
  const [scraping, setScraping] = useState(false);

  const loadPool = useCallback(async () => {
    try {
      const data = await fetchApi<ProxyPoolStatus>("/api/proxy-pool/pool");
      setPool(data);
    } catch {
      setPool({ count: 0, activeCount: 0, proxies: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPool();
    fetchProxyCountries()
      .then((data) => setCountries(data.countries))
      .catch(() => setCountries([{ code: "all", name: "Any region" }]));
  }, [loadPool]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const result = await scrapeProxies({ source: scrapeSource, country: scrapeCountry, protocol: scrapeProtocol, limit: scrapeLimit, verify: scrapeVerify });
      if (result.added > 0) {
        setMessage(`Scraped ${result.scraped}, ${result.added} added` + (scrapeVerify ? ` (${result.verified} alive)` : "") + (result.skipped > 0 ? `, ${result.skipped} duplicates` : ""));
      } else if (result.scraped === 0) {
        setMessage("No proxies found for that region/source");
      } else {
        setMessage(scrapeVerify && result.verified === 0 ? `Scraped ${result.scraped} but none passed health check` : "All scraped proxies already in pool");
      }
      loadPool();
    } catch (e: any) {
      setMessage(e.message || "Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) { setMessage("Paste proxy list first"); return; }
    const proxies = bulkText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (proxies.length === 0) { setMessage("No valid proxies found"); return; }
    try {
      const result = await fetchApi<{ added: number }>("/api/proxy-pool/pool", { method: "POST", body: JSON.stringify({ proxies }) });
      setBulkText("");
      setMessage(`${result.added} proxy added`);
      setShowAdd(false);
      loadPool();
    } catch (e: any) {
      setMessage(e.message || "Failed to add proxies");
    }
  };

  const handleToggle = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      await fetchApi(`/api/proxy-pool/pool/${id}`, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
      loadPool();
    } catch (e: any) { setMessage(e.message || "Failed"); }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetchApi(`/api/proxy-pool/pool/${id}`, { method: "DELETE" });
      loadPool();
    } catch (e: any) { setMessage(e.message || "Failed"); }
  };

  const handleClearAll = async () => {
    if (!confirm("Remove all proxies from pool?")) return;
    try {
      await fetchApi("/api/proxy-pool/pool", { method: "DELETE" });
      setMessage("Pool cleared");
      loadPool();
    } catch (e: any) { setMessage(e.message || "Failed"); }
  };

  const handleCheckSingle = async (id: number) => {
    try {
      const result = await fetchApi<{ ok: boolean; latencyMs: number; error?: string }>(`/api/proxy-pool/pool/${id}/check`, { method: "POST" });
      setMessage(result.ok ? `Healthy (${result.latencyMs}ms)` : `Failed: ${result.error}`);
      loadPool();
    } catch (e: any) { setMessage(e.message || "Check failed"); }
  };

  const handleCheckAll = async () => {
    setChecking(true);
    try {
      const result = await fetchApi<{ checked: number }>("/api/proxy-pool/pool/check-all", { method: "POST" });
      setMessage(`Checked ${result.checked} proxies`);
      loadPool();
    } catch (e: any) { setMessage(e.message || "Check all failed"); }
    finally { setChecking(false); }
  };

  const maskUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.password ? `${u.protocol}//${u.username}:***@${u.host}` : `${u.protocol}//${u.host}`;
    } catch { return url; }
  };

  const errorCount = pool.proxies.filter((p) => p.status === "error").length;
  const disabledCount = pool.proxies.filter((p) => p.status === "disabled").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--info)]/20 to-violet-500/10 border border-[var(--info)]/20">
            <Globe className="w-5 h-5 text-[var(--info)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Proxy Pool</h1>
            <p className="text-xs text-[var(--muted-foreground)]">HTTP/SOCKS5 proxies for upstream requests</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 hover:bg-[var(--primary)]/20 transition-all">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          <button onClick={() => setShowScrape(!showScrape)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--info)]/10 text-[var(--info)] border border-[var(--info)]/20 hover:bg-[var(--info)]/20 transition-all">
            <Download className="w-3.5 h-3.5" /> Scrape
          </button>
          <button onClick={handleCheckAll} disabled={checking} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} /> Check All
          </button>
          {pool.count > 0 && (
            <button onClick={handleClearAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20 hover:bg-[var(--error)]/20 transition-all">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className="px-4 py-2.5 rounded-lg bg-[var(--secondary)] text-sm text-[var(--foreground)] border border-[var(--border)]">
          {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--foreground)]">{pool.count}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Total</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--success)]">{pool.activeCount}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Active</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--warning)]">{disabledCount}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Disabled</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--error)]">{errorCount}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Error</p>
        </div>
      </div>

      {/* Add Proxies (collapsible) */}
      {showAdd && (
        <Card className="border-[var(--border)] overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-[var(--primary)] to-emerald-500" />
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-[var(--muted-foreground)]">Paste proxy list (one per line): http://user:pass@host:port</p>
            <textarea
              className="w-full h-[100px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
              placeholder={"http://user:pass@host:port\nsocks5://host:port"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <button onClick={handleBulkAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-all">
              <Upload className="w-4 h-4" /> Add to Pool
            </button>
          </CardContent>
        </Card>
      )}

      {/* Scrape Proxies (collapsible) */}
      {showScrape && (
        <Card className="border-[var(--border)] overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-[var(--info)] to-violet-500" />
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-[var(--muted-foreground)]">Pull fresh proxies from free public sources.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--muted-foreground)] uppercase">Source</label>
                <select className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs" value={scrapeSource} onChange={(e) => setScrapeSource(e.target.value as any)}>
                  <option value="all">All</option>
                  <option value="proxyscrape">ProxyScrape</option>
                  <option value="geonode">Geonode</option>
                  <option value="proxifly">Proxifly</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--muted-foreground)] uppercase">Region</label>
                <select className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs" value={scrapeCountry} onChange={(e) => setScrapeCountry(e.target.value)}>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--muted-foreground)] uppercase">Protocol</label>
                <select className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs" value={scrapeProtocol} onChange={(e) => setScrapeProtocol(e.target.value as any)}>
                  <option value="all">HTTP + SOCKS5</option>
                  <option value="http">HTTP</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--muted-foreground)] uppercase">Max</label>
                <input type="number" min={1} max={500} className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs" value={scrapeLimit} onChange={(e) => setScrapeLimit(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] cursor-pointer">
                <input type="checkbox" checked={scrapeVerify} onChange={(e) => setScrapeVerify(e.target.checked)} className="rounded" />
                Verify before adding
              </label>
              <button onClick={handleScrape} disabled={scraping} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--info)] text-white hover:opacity-90 transition-all disabled:opacity-50">
                <Download className={`w-4 h-4 ${scraping ? "animate-pulse" : ""}`} />
                {scraping ? "Scraping..." : "Scrape"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proxy List */}
      <Card className="border-[var(--border)]">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">Loading...</div>
          ) : pool.proxies.length === 0 ? (
            <div className="p-8 text-center">
              <Globe className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-2" />
              <p className="text-sm text-[var(--muted-foreground)]">No proxies in pool</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Add or scrape proxies to enable IP rotation</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {pool.proxies.map((proxy) => (
                <div key={proxy.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--secondary)]/30 transition-colors ${proxy.status === "disabled" ? "opacity-50" : ""}`}>
                  {/* Status dot */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    proxy.status === "active" ? "bg-[var(--success)]" :
                    proxy.status === "error" ? "bg-[var(--error)]" :
                    "bg-[var(--muted-foreground)]"
                  }`} />

                  {/* URL + type */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-[var(--foreground)] truncate">{maskUrl(proxy.url)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[var(--muted-foreground)]">{proxy.type}</span>
                      {proxy.latencyMs != null && (
                        <span className={`text-[10px] font-mono ${proxy.latencyMs < 1000 ? "text-[var(--success)]" : proxy.latencyMs < 3000 ? "text-[var(--warning)]" : "text-[var(--error)]"}`}>
                          {proxy.latencyMs < 1000 ? `${proxy.latencyMs}ms` : `${(proxy.latencyMs / 1000).toFixed(1)}s`}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--muted-foreground)]">{proxy.successCount}✓ {proxy.failCount}✗</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => handleCheckSingle(proxy.id)} className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors" title="Check">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggle(proxy.id, proxy.status)} className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors" title={proxy.status === "active" ? "Disable" : "Enable"}>
                      {proxy.status === "active" ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDelete(proxy.id)} className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Loader2,
  Image as ImageIcon,
  Video,
  Download,
  RefreshCw,
  Wand2,
  Trash2,
  Bot,
  User as UserIcon,
  Check,
  X,
  ChevronDown,
  Hash,
  Crop,
  Layers,
  Palette,
  Maximize2,
  Clock,
  Zap,
} from "lucide-react";
import {
  assistPrompt,
  fetchAssistModels,
  generateImage,
  fetchChats,
  fetchChat,
  createChat,
  updateChat,
  fetchResults,
  deleteResult,
  clearResults,
  type AssistModelInfo,
  type ChatMessage,
  type StoredResult,
} from "@/lib/api";

type GenType = "image" | "video";

interface GenResult {
  id: number;
  prompt: string;
  type: GenType;
  aspectRatio: string;
  n: number;
  urls: string[];
  creditsUsed: number;
  createdAt: number;
}

function resultFromStored(r: StoredResult): GenResult {
  return {
    id: r.id,
    prompt: r.prompt,
    type: r.type,
    aspectRatio: r.aspectRatio,
    n: r.n,
    urls: Array.isArray(r.urls) ? r.urls : [],
    creditsUsed: r.creditsUsed,
    createdAt: new Date(r.createdAt).getTime(),
  };
}

const ASPECT_RATIOS: Array<{ value: string; label: string; icon: string }> = [
  { value: "1:1", label: "Square", icon: "■" },
  { value: "16:9", label: "Landscape", icon: "▬" },
  { value: "9:16", label: "Portrait", icon: "▮" },
  { value: "4:3", label: "Classic", icon: "▭" },
  { value: "3:4", label: "Photo", icon: "▯" },
  { value: "5:4", label: "Studio", icon: "▭" },
  { value: "4:5", label: "Social", icon: "▯" },
  { value: "2:1", label: "Cinematic", icon: "▬" },
];

function labelProvider(provider: string) {
  if (provider === "kiro-pro") return "Kiro Pro";
  if (provider === "codebuddy") return "CodeBuddy";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ImageStudio() {
  const [assistModels, setAssistModels] = useState<AssistModelInfo[]>([]);
  const [assistModel, setAssistModel] = useState<string>("auto");
  const [genType, setGenType] = useState<GenType>("image");
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [n, setN] = useState<number>(1);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenResult[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSaveRef = useRef(true);

  function markBroken(url: string) {
    setBrokenUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }

  async function removeResult(id: number) {
    setResults((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteResult(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function clearHistory() {
    if (results.length === 0) return;
    if (!confirm("Clear all results from history?")) return;
    setResults([]);
    setBrokenUrls(new Set());
    try {
      await clearResults(chatId ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function regenerate(r: GenResult) {
    setGenerating(true);
    setError(null);
    try {
      const res = await generateImage({
        prompt: r.prompt,
        type: r.type,
        aspectRatio: r.aspectRatio,
        n: r.n,
        chatId,
      });
      const fresh: GenResult = {
        id: res.id ?? Date.now(),
        prompt: res.prompt,
        type: res.type as GenType,
        aspectRatio: res.aspectRatio,
        n: res.n,
        urls: res.urls,
        creditsUsed: res.creditsUsed,
        createdAt: res.createdAt ? new Date(res.createdAt).getTime() : Date.now(),
      };
      setResults((prev) => [...prev, fresh]);
      try {
        await deleteResult(r.id);
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    fetchAssistModels()
      .then((res) => {
        setAssistModels(res.data || []);
        const auto = res.data?.find((m) => m.id === "auto");
        if (auto) setAssistModel(auto.id);
        else if (res.data?.[0]) setAssistModel(res.data[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const chatsRes = await fetchChats();
        const latest = chatsRes.data?.[0];
        let activeChatId: number | null = null;
        if (latest) {
          const full = await fetchChat(latest.id);
          if (cancelled) return;
          activeChatId = full.id;
          setChatId(full.id);
          setMessages(Array.isArray(full.messages) ? full.messages : []);
          setFinalPrompt(full.finalPrompt);
          setCurrentOptions(Array.isArray(full.options) ? full.options : []);
          if (full.assistModel) setAssistModel(full.assistModel);
        }
        const resultsRes = await fetchResults(
          activeChatId !== null ? { chatId: activeChatId, limit: 50 } : { limit: 50 },
        );
        if (cancelled) return;
        setResults((resultsRes.data || []).map(resultFromStored));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
          skipSaveRef.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skipSaveRef.current || loadingHistory) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        if (chatId === null) {
          if (messages.length === 0) return;
          const created = await createChat({
            messages,
            finalPrompt,
            options: currentOptions,
            assistModel,
          });
          setChatId(created.id);
        } else {
          await updateChat(chatId, {
            messages,
            finalPrompt,
            options: currentOptions,
            assistModel,
          });
        }
      } catch (err) {
        console.error("[ImageStudio] failed to persist chat:", err);
      }
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [messages, finalPrompt, currentOptions, assistModel, chatId, loadingHistory]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  useEffect(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = previewScrollRef.current.scrollHeight;
    }
  }, [results.length, generating]);

  const groupedModels = useMemo(() => {
    const map = new Map<string, AssistModelInfo[]>();
    for (const m of assistModels) {
      const list = map.get(m.provider) || [];
      list.push(m);
      map.set(m.provider, list);
    }
    return Array.from(map.entries());
  }, [assistModels]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const newHistory: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newHistory);
    setInput("");
    setCurrentOptions([]);
    setError(null);
    setThinking(true);
    try {
      const res = await assistPrompt({ message: trimmed, history: messages, model: assistModel });
      setMessages([...newHistory, { role: "assistant", content: res.reply || "(empty)" }]);
      setCurrentOptions(res.options || []);
      if (res.finalPrompt) setFinalPrompt(res.finalPrompt);
    } catch (err) {
      setMessages(newHistory);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setThinking(false);
    }
  }

  async function send() {
    await sendMessage(input);
  }

  async function pickOption(option: string) {
    await sendMessage(option);
  }

  async function generate() {
    let prompt = finalPrompt || input.trim();
    if (!prompt) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m && m.role === "user") {
          prompt = m.content;
          break;
        }
      }
    }
    if (!prompt) {
      setError("No prompt available — chat first to get a final prompt, or type one manually.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await generateImage({ prompt, type: genType, aspectRatio, n, chatId });
      const result: GenResult = {
        id: res.id ?? Date.now(),
        prompt: res.prompt,
        type: res.type as GenType,
        aspectRatio: res.aspectRatio,
        n: res.n,
        urls: res.urls,
        creditsUsed: res.creditsUsed,
        createdAt: res.createdAt ? new Date(res.createdAt).getTime() : Date.now(),
      };
      setResults((prev) => [...prev, result]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  function resetChat() {
    setMessages([]);
    setFinalPrompt(null);
    setCurrentOptions([]);
    setInput("");
    setError(null);
  }

  function downloadUrl(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const totalCredits = results.reduce((sum, r) => sum + r.creditsUsed, 0);
  const totalImages = results.reduce((sum, r) => sum + r.urls.length, 0);

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-3rem)] flex-col gap-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-[var(--primary)]/20 border border-fuchsia-500/20">
            <Palette className="h-5 w-5 text-fuchsia-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)]">Image Studio</h1>
            <p className="text-[11px] text-[var(--muted-foreground)]">AI-powered prompt assistant for Canva Magic Media</p>
          </div>
        </div>

        {results.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)]">
              <ImageIcon className="h-3 w-3" />
              {totalImages} images
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--warning)]/10 text-[var(--warning)]">
              <Zap className="h-3 w-3" />
              {totalCredits} credits
            </span>
          </div>
        )}
      </div>

      {/* Main 2-column area */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* LEFT: Chat panel */}
        <div className="flex h-full min-h-0 flex-col gap-2">
          {/* Settings strip */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
            <Bot className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <div className="relative">
              <select
                value={assistModel}
                onChange={(e) => setAssistModel(e.target.value)}
                className="h-7 max-w-[140px] appearance-none truncate rounded-lg border border-[var(--border)] bg-[var(--background)] pl-2 pr-6 text-[11px] text-[var(--foreground)] focus:border-[var(--primary)]/50 focus:outline-none"
                title="AI Assist Model"
              >
                {groupedModels.map(([provider, list]) => (
                  <optgroup key={provider} label={labelProvider(provider)}>
                    {list.map((m) => (
                      <option key={m.id} value={m.id}>{m.id}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted-foreground)]" />
            </div>

            <div className="h-5 w-px bg-[var(--border)]" />

            {/* Type toggle */}
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5">
              <button
                type="button"
                onClick={() => setGenType("image")}
                className={`flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-all ${
                  genType === "image"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <ImageIcon className="h-3 w-3" /> Image
              </button>
              <button
                type="button"
                onClick={() => setGenType("video")}
                className={`flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-all ${
                  genType === "video"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Video className="h-3 w-3" /> Video
              </button>
            </div>

            <div className="h-5 w-px bg-[var(--border)]" />

            {/* Count */}
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5">
              {[1, 2, 3, 4].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setN(v)}
                  disabled={genType === "video"}
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-medium transition-all disabled:opacity-30 ${
                    n === v && genType !== "video"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {genType !== "video" && (
              <>
                <div className="h-5 w-px bg-[var(--border)]" />
                <Crop className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <div className="relative">
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="h-7 w-[70px] appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] pl-2 pr-5 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--primary)]/50 focus:outline-none"
                  >
                    {ASPECT_RATIOS.map((r) => (
                      <option key={r.value} value={r.value}>{r.icon} {r.value}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted-foreground)]" />
                </div>
              </>
            )}
          </div>

          {/* Chat panel */}
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)]/20 to-fuchsia-500/10">
                  <Wand2 className="h-3.5 w-3.5 text-[var(--primary)]" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-[var(--foreground)]">Prompt Assistant</h2>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {messages.length === 0 ? "Ready to help" : `${messages.length} messages`}
                  </p>
                </div>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={resetChat}
                  title="Reset chat"
                  className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Chat messages */}
            <div ref={chatScrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && !thinking && (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 animate-pulse rounded-full bg-[var(--primary)]/10 blur-xl" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-fuchsia-500/15 ring-1 ring-inset ring-[var(--primary)]/30">
                      <Sparkles className="h-6 w-6 text-[var(--primary)]" />
                    </div>
                  </div>
                  <p className="mb-1 text-sm font-medium text-[var(--foreground)]">
                    Start with your image idea
                  </p>
                  <p className="max-w-xs text-xs leading-relaxed text-[var(--muted-foreground)]">
                    AI will ask a few questions to refine your prompt into something specific and detailed.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                    {[
                      "anime girl in flower garden",
                      "minimalist coffee shop logo",
                      "futuristic city skyline",
                    ].map((sample) => (
                      <button
                        key={sample}
                        onClick={() => sendMessage(sample)}
                        className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 hover:text-[var(--foreground)] hover:shadow-sm"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                      msg.role === "user"
                        ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <UserIcon className="h-3 w-3" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] ${
                      msg.role === "user"
                        ? "rounded-tr-sm bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "rounded-tl-sm bg-[var(--secondary)] text-[var(--foreground)]"
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}

              {!thinking && currentOptions.length > 0 && (
                <div className="ml-8 flex flex-wrap gap-1.5">
                  {currentOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => pickOption(opt)}
                      disabled={thinking}
                      className="rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-3 py-1 text-[11px] text-[var(--foreground)] transition-all hover:border-[var(--primary)]/60 hover:bg-[var(--primary)]/10 hover:shadow-sm disabled:opacity-50"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {thinking && (
                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
                    <Bot className="h-3 w-3" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-[var(--secondary)] px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted-foreground)] [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted-foreground)] [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted-foreground)]" />
                    </div>
                  </div>
                </div>
              )}

              {finalPrompt && (
                <div className="rounded-xl border border-[var(--primary)]/30 bg-gradient-to-br from-[var(--primary)]/10 via-[var(--primary)]/5 to-transparent p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                        Final Prompt
                      </span>
                    </div>
                    <button
                      onClick={() => setFinalPrompt(null)}
                      className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mb-3 whitespace-pre-wrap text-xs leading-relaxed text-[var(--foreground)]">
                    {finalPrompt}
                  </div>
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-[var(--primary)] to-emerald-500 text-[var(--primary-foreground)] hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-[var(--primary)]/20"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate {genType === "video" ? "Video" : `${n} ${n === 1 ? "Image" : "Images"}`}
                        {genType !== "video" && (
                          <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
                            {aspectRatio}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="border-t border-[var(--error)]/20 bg-[var(--error)]/10 px-3 py-2 text-xs text-[var(--error)]">
                {error}
              </div>
            )}

            {/* Input */}
            <div className="border-t border-[var(--border)] bg-[var(--card)] p-3">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Describe your image idea... (Enter to send)"
                  className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  rows={2}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || thinking}
                  className="self-end flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-all disabled:opacity-40 shadow-sm"
                >
                  {thinking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Preview panel */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-[var(--success)]/10">
                <ImageIcon className="h-3.5 w-3.5 text-[var(--success)]" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-[var(--foreground)]">Gallery</h2>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {results.length === 0 ? "No results yet" : `${results.length} generations`}
                </p>
              </div>
            </div>
            {results.length > 0 && (
              <button
                onClick={clearHistory}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--error)]/10 hover:text-[var(--error)] transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <div ref={previewScrollRef} className="flex-1 overflow-y-auto p-4">
            {results.length === 0 && !generating && (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-sm text-center">
                  <div className="relative mx-auto mb-4 h-16 w-16">
                    <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-br from-emerald-500/10 via-[var(--primary)]/10 to-fuchsia-500/10 blur-xl" />
                    <div className="relative flex h-full w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--background)]">
                      <ImageIcon className="h-7 w-7 text-[var(--muted-foreground)]" />
                    </div>
                  </div>
                  <p className="mb-1 text-sm font-medium text-[var(--foreground)]">Gallery is empty</p>
                  <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                    Start chatting on the left, then click Generate. Results will appear here and auto-save.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {results.map((r) => {
                const allBroken = r.urls.length > 0 && r.urls.every((u) => brokenUrls.has(u));
                return (
                  <div
                    key={r.id}
                    className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]/50 transition-all hover:border-[var(--primary)]/20"
                  >
                    {/* Result header */}
                    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs leading-relaxed text-[var(--foreground)]">
                          {r.prompt}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.type === "video" ? "bg-[var(--warning)]/10 text-[var(--warning)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                          }`}>
                            {r.type === "video" ? <Video className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                            {r.type}
                          </span>
                          <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
                            {r.aspectRatio}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--muted-foreground)]">
                            <Zap className="h-2.5 w-2.5" /> {r.creditsUsed}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--muted-foreground)]">
                            <Clock className="h-2.5 w-2.5" /> {timeAgo(r.createdAt)}
                          </span>
                          {allBroken && (
                            <span className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] text-[var(--warning)]">
                              expired
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-0.5">
                        <button
                          onClick={() => regenerate(r)}
                          disabled={generating}
                          className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-50"
                          title="Regenerate"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeResult(r.id)}
                          className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Result media */}
                    <div
                      className={`grid gap-2 p-3 ${
                        r.urls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                      }`}
                    >
                      {r.urls.map((url, i) => {
                        const broken = brokenUrls.has(url);
                        const [aw, ah] = r.aspectRatio.split(":").map(Number);
                        const aspectStyle =
                          r.type !== "video" && aw && ah ? { aspectRatio: `${aw} / ${ah}` } : undefined;
                        return (
                          <div
                            key={i}
                            style={aspectStyle}
                            className="group/img relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--secondary)]"
                          >
                            {broken ? (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center">
                                <ImageIcon className="h-5 w-5 text-[var(--warning)]" />
                                <p className="text-[10px] text-[var(--muted-foreground)]">Link expired</p>
                              </div>
                            ) : r.type === "video" ? (
                              <video
                                src={url}
                                controls
                                onError={() => markBroken(url)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <img
                                src={url}
                                alt={`generated ${i + 1}`}
                                loading="lazy"
                                onError={() => markBroken(url)}
                                onClick={() => setLightbox(url)}
                                className="h-full w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover/img:scale-[1.03]"
                              />
                            )}
                            {!broken && (
                              <>
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover/img:opacity-100" />
                                <button
                                  onClick={() =>
                                    downloadUrl(url, `studio_${r.aspectRatio.replace(":", "x")}_${r.id}_${i + 1}.${r.type === "video" ? "mp4" : "png"}`)
                                  }
                                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/80 group-hover/img:opacity-100"
                                  title="Download"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setLightbox(url)}
                                  className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/80 group-hover/img:opacity-100"
                                  title="Fullscreen"
                                >
                                  <Maximize2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {generating && (
              <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-[var(--primary)]/40 bg-gradient-to-br from-[var(--primary)]/5 via-transparent to-fuchsia-500/5 p-8">
                <div className="text-center">
                  <div className="relative mx-auto mb-3 h-10 w-10">
                    <div className="absolute inset-0 animate-ping rounded-full bg-[var(--primary)]/20" />
                    <Loader2 className="relative h-10 w-10 animate-spin text-[var(--primary)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Generating {genType}...
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Canva Magic Media is creating your {genType}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/95 p-8 backdrop-blur-sm"
        >
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox}
            alt="full"
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

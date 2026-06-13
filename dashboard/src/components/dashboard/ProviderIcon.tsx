/**
 * Custom SVG icons for each AI provider.
 * Each icon is designed to be recognizable and visually distinct.
 */

interface IconProps {
  className?: string;
  size?: number;
}

/** Kiro — AWS-inspired swoosh arrow */
function KiroIcon({ className, size = 24 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <defs>
        <linearGradient id="kiro-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path
        d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8"
        stroke="url(#kiro-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M12 20l-3-3m3 3l3-3"
        stroke="url(#kiro-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2" fill="url(#kiro-grad)" />
    </svg>
  );
}

/** Kiro Pro — Enhanced with star/pro badge */
function KiroProIcon({ className, size = 24 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <defs>
        <linearGradient id="kiropro-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path
        d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8"
        stroke="url(#kiropro-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M12 20l-3-3m3 3l3-3"
        stroke="url(#kiropro-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7l1.1 2.2 2.4.4-1.7 1.7.4 2.4L12 12.6l-2.2 1.1.4-2.4-1.7-1.7 2.4-.4L12 7z"
        fill="url(#kiropro-grad)"
      />
    </svg>
  );
}

/** CodeBuddy — Code brackets with Tencent-inspired style */
function CodeBuddyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <defs>
        <linearGradient id="cb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="url(#cb-grad)" strokeWidth="2" />
      <path
        d="M9 8L6 12l3 4"
        stroke="url(#cb-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 8l3 4-3 4"
        stroke="url(#cb-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 7l-2 10"
        stroke="url(#cb-grad)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Canva — Gradient circle with "C" */
function CanvaIcon({ className, size = 24 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <defs>
        <linearGradient id="canva-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#canva-grad)" strokeWidth="2.5" />
      <path
        d="M15 9.5C14.2 8.5 13.2 8 12 8c-2.2 0-4 1.8-4 4s1.8 4 4 4c1.2 0 2.2-.5 3-1.5"
        stroke="url(#canva-grad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Codex — OpenAI-inspired hexagonal shape */
function CodexIcon({ className, size = 24 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <defs>
        <linearGradient id="codex-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <path
        d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
        stroke="url(#codex-grad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="url(#codex-grad)" strokeWidth="2" />
      <path d="M12 9V3" stroke="url(#codex-grad)" strokeWidth="1.5" />
      <path d="M14.6 13.5L20 16.5" stroke="url(#codex-grad)" strokeWidth="1.5" />
      <path d="M9.4 13.5L4 16.5" stroke="url(#codex-grad)" strokeWidth="1.5" />
    </svg>
  );
}

/** Qoder — Terminal/command prompt style */
function QoderIcon({ className, size = 24 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <defs>
        <linearGradient id="qoder-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="url(#qoder-grad)" strokeWidth="2" />
      <path d="M3 8h18" stroke="url(#qoder-grad)" strokeWidth="2" />
      <circle cx="5.5" cy="6" r="0.8" fill="url(#qoder-grad)" />
      <circle cx="8" cy="6" r="0.8" fill="url(#qoder-grad)" />
      <circle cx="10.5" cy="6" r="0.8" fill="url(#qoder-grad)" />
      <path
        d="M7 12l3 2.5L7 17"
        stroke="url(#qoder-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 17h4"
        stroke="url(#qoder-grad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** BYOK — Key with custom badge */
function ByokIcon({ className, size = 24 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <defs>
        <linearGradient id="byok-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <circle cx="8" cy="10" r="5" stroke="url(#byok-grad)" strokeWidth="2" />
      <circle cx="8" cy="10" r="2" stroke="url(#byok-grad)" strokeWidth="1.5" />
      <path
        d="M12 12h7"
        stroke="url(#byok-grad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17 12v3"
        stroke="url(#byok-grad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19 12v2"
        stroke="url(#byok-grad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Main export — renders the correct icon for a provider */
export default function ProviderIcon({ provider, size = 24, className }: { provider: string; size?: number; className?: string }) {
  switch (provider.toLowerCase()) {
    case "kiro":
      return <KiroIcon size={size} className={className} />;
    case "kiro-pro":
      return <KiroProIcon size={size} className={className} />;
    case "codebuddy":
      return <CodeBuddyIcon size={size} className={className} />;
    case "canva":
      return <CanvaIcon size={size} className={className} />;
    case "codex":
      return <CodexIcon size={size} className={className} />;
    case "qoder":
      return <QoderIcon size={size} className={className} />;
    case "byok":
      return <ByokIcon size={size} className={className} />;
    default:
      return <ByokIcon size={size} className={className} />;
  }
}

/** Provider background gradient classes for cards */
export const providerGradients: Record<string, string> = {
  kiro: "from-sky-500/10 to-sky-600/5",
  "kiro-pro": "from-violet-500/10 to-purple-600/5",
  codebuddy: "from-pink-500/10 to-rose-600/5",
  canva: "from-purple-500/10 to-teal-500/5",
  codex: "from-emerald-500/10 to-green-600/5",
  qoder: "from-amber-500/10 to-yellow-600/5",
  byok: "from-orange-500/10 to-red-500/5",
};

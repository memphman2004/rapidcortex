"use client";

import type { ReactNode } from "react";
import { useSession } from "@/components/auth/session-context";
import { useContentProtection } from "@/hooks/useContentProtection";
import { useDemoMode } from "@/hooks/useDemoMode";
import { COPYRIGHT } from "@/lib/copyright";
import { isContentProtectionEnabled } from "@/lib/runtime-flags";
import { DemoModeToggle } from "./DemoModeToggle";

type Props = {
  children: ReactNode;
  /** Show demo-mode control in the banner row. */
  showDemoToggle?: boolean;
};

/**
 * Scoped content protection wrapper.
 * Do **not** wrap live dispatch consoles — operators must copy incident notes/phone numbers.
 * Intended for sales portal / enablement surfaces.
 */
export function ProtectedPage({ children, showDemoToggle = true }: Props) {
  const { user } = useSession();
  const enabled = isContentProtectionEnabled();
  const email = user?.email?.trim() || user?.userId || "unknown";

  const { isDemoActive, demoSession } = useDemoMode(email);
  const { isScreenShareActive, isWindowFocused } = useContentProtection({
    enabled,
    hideOnScreenShare: enabled && !isDemoActive,
    blurOnFocusLoss: enabled && !isDemoActive,
    blockExtraction: enabled,
  });

  if (!enabled) return <>{children}</>;

  const shouldObscure = !isDemoActive && (isScreenShareActive || !isWindowFocused);
  const hash = email.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const angle = isDemoActive ? -25 : -(22 + (hash % 18));
  const opacity = isDemoActive ? 0.07 : 0.03 + (hash % 12) * 0.002;
  const label = isDemoActive
    ? `DEMO · ${email} · ${new Date().toLocaleDateString()}`
    : `${email} · NEXCORT IQ CONFIDENTIAL`;

  return (
    <div
      className="relative select-none"
      onContextMenu={(e) => {
        const t = e.target as HTMLElement;
        if (!t.closest("input, textarea, select, [contenteditable='true']")) {
          e.preventDefault();
        }
      }}
    >
      {isDemoActive ? (
        <div className="fixed inset-x-0 top-0 z-[10001] flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <span className="text-[13px] font-semibold tracking-wide text-amber-300">
              DEMO MODE ACTIVE
            </span>
            <span className="text-xs text-amber-300/50">
              Screen share enabled · Copy/print still protected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-amber-300/60">
              Expires {demoSession?.remainingLabel}
            </span>
            {showDemoToggle ? <DemoModeToggle userEmail={email} /> : null}
          </div>
        </div>
      ) : showDemoToggle ? (
        <div className="mb-3 flex justify-end">
          <DemoModeToggle userEmail={email} />
        </div>
      ) : null}

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9990] flex flex-wrap items-center justify-center gap-x-[90px] gap-y-[70px] overflow-hidden font-mono text-[13px] tracking-wide"
        style={{
          opacity,
          transform: `rotate(${angle}deg)`,
          color: isDemoActive ? "#fbbf24" : "white",
          fontSize: isDemoActive ? 15 : 13,
        }}
      >
        {Array.from({ length: 40 }, (_, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      {shouldObscure ? (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-5 bg-black/90 backdrop-blur-3xl">
          <p className="m-0 text-center text-xl font-semibold text-slate-100">
            {isScreenShareActive
              ? "Content hidden during screen sharing"
              : "Return to this window to resume"}
          </p>
          <p className="m-0 max-w-md text-center text-[13px] text-white/40">
            Start Demo Mode to allow authorized screen sharing for demos and training. This event
            has been logged.
          </p>
          {showDemoToggle ? <DemoModeToggle userEmail={email} /> : null}
        </div>
      ) : null}

      <style>{`
        @media print {
          body > * { display: none !important; }
          body::after {
            display: block;
            content: "Printing is unauthorized. ${COPYRIGHT.shortNotice}";
            font-size: 18px;
            text-align: center;
            padding: 60px;
          }
        }
      `}</style>

      <div className={isDemoActive ? "pt-11" : undefined}>{children}</div>
    </div>
  );
}

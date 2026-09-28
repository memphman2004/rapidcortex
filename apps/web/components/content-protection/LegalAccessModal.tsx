"use client";

import { useEffect, useState } from "react";
import { COPYRIGHT } from "@/lib/copyright";
import { isContentProtectionEnabled } from "@/lib/runtime-flags";

const STORAGE_KEY = "rc_legal_acknowledged";

/** Optional first-visit IP acknowledgment (sales/enablement surfaces). */
export function LegalAccessModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isContentProtectionEnabled()) return;
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const acknowledge = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      /* ignore */
    }
    setVisible(false);
    void fetch("/api/security/log-violation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        violations: [
          {
            eventType: "terms_acknowledged",
            pageUrl: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    }).catch(() => {});
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 p-6">
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-950 px-10 py-10">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-red-500">
          Proprietary & Confidential
        </p>
        <h2 className="mb-5 text-[22px] font-semibold text-slate-100">
          Intellectual Property Notice
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-slate-400">{COPYRIGHT.accessWarning}</p>
        <p className="mb-7 text-sm leading-relaxed text-slate-400">
          By continuing you acknowledge that content is proprietary, you will not copy or
          redistribute it, and that sessions may be logged.
        </p>
        <p className="mb-7 text-xs text-slate-500">{COPYRIGHT.notice(true)}</p>
        <button
          type="button"
          onClick={acknowledge}
          className="w-full rounded-lg bg-sky-600 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-sky-500"
        >
          I Understand & Agree — Continue
        </button>
      </div>
    </div>
  );
}

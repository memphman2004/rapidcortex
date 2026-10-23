"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { businessCardSelfHref, bizCardFetch, type BizCardStatus } from "@/lib/business-cards/client";
import { isBusinessCardsUiEnabled } from "@/lib/runtime-flags";

const DISMISS_KEY = "bizcard-setup";

export function BusinessCardLoginPrompt({ isAdmin, agencyId }: { isAdmin: boolean; agencyId?: string }) {
  const pathname = usePathname() ?? "";
  const [status, setStatus] = useState<BizCardStatus | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (agencyId !== "__platform__" || !isBusinessCardsUiEnabled()) return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    void bizCardFetch<BizCardStatus>("/api/business-cards/status")
      .then((next) => {
        window.sessionStorage.setItem("bizCardStatus", JSON.stringify(next));
        setStatus(next);
        window.dispatchEvent(new CustomEvent("rc-bizcard-status", { detail: next }));
      })
      .catch(() => undefined);
  }, [agencyId]);

  if (!status?.enabled) return null;
  const href = businessCardSelfHref(pathname);
  const showBanner = !status.hasProfile && !dismissed;
  const ratio = status.totalProfiles ? (status.activeProfiles ?? 0) / status.totalProfiles : 0;
  const showWidget = isAdmin && status.totalProfiles !== undefined && (status.totalProfiles === 0 || ratio < 0.5);
  return (
    <>
      {showBanner ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100">
          <span>Set up your digital business card — share your contact info with a tap.</span>
          <Link className="rounded bg-sky-700 px-2 py-1 text-xs" href={href}>Set Up My Card</Link>
          <button
            type="button"
            className="ml-auto text-xs text-slate-400"
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {showWidget ? (
        <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-300">
          {status.activeProfiles ?? 0} of {status.totalProfiles} cards are active.{" "}
          <Link className="underline" href={href.replace("/profile/business-card", "/admin/business-cards")}>Manage cards</Link>
        </div>
      ) : null}
    </>
  );
}

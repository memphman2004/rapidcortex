"use client";

import { Play, X } from "lucide-react";
import { useCallback, useEffect, useId, useState, type MouseEvent } from "react";
import { marketingIntroYoutubeEmbedUrl } from "@/lib/marketing-intro-video";

const overlayClass =
  "fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 sm:p-6";

function WatchDemoYoutubeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const stopContentClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!open) return null;

  return (
    <div className={overlayClass} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-[900px] shadow-2xl shadow-black/60"
        onClick={stopContentClick}
      >
        <h2 id={titleId} className="sr-only">
          Rapid Cortex demo video
        </h2>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/15 bg-black">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            aria-label="Close video"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <iframe
            title="Rapid Cortex introductory video"
            src={marketingIntroYoutubeEmbedUrl({ autoplay: true })}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>
  );
}

const heroButtonClass =
  "inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-md border border-white/90 bg-transparent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-white/10 sm:w-auto";

const pricingLinkClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 underline-offset-4 transition hover:text-white hover:underline";

const downloadsLinkClass =
  "inline-flex items-center text-sm font-medium text-sky-400/90 underline-offset-4 transition hover:text-sky-300 hover:underline";

export function WatchDemoHeroButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={heroButtonClass} onClick={() => setOpen(true)}>
        <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden />
        Watch Demo
      </button>
      <WatchDemoYoutubeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function WatchDemoPricingLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={pricingLinkClass} onClick={() => setOpen(true)}>
        <Play className="h-3.5 w-3.5 shrink-0 fill-current text-sky-400/90" aria-hidden />
        Watch Demo
      </button>
      <WatchDemoYoutubeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function WatchDemoDownloadsLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={downloadsLinkClass} onClick={() => setOpen(true)}>
        See it in action →
      </button>
      <WatchDemoYoutubeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

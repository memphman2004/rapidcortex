"use client";

import { useCallback, useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { absoluteUrl } from "@/lib/seo";

const ogAssetPath = "/api/og";

export type DemoShareRowProps = {
  /** Fully qualified page URL for LinkedIn and copy (e.g. https://rapidcortex.us/demo). */
  shareUrl: string;
};

export function DemoShareRow({ shareUrl }: DemoShareRowProps) {
  const [copied, setCopied] = useState(false);

  const linkedInHref = `https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const ogHref = absoluteUrl(ogAssetPath);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, [shareUrl]);

  const btnClass =
    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600/90 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800/80 sm:flex-initial";

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
      <a href={linkedInHref} target="_blank" rel="noopener noreferrer" className={btnClass}>
        <Share2 className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
        Share on LinkedIn
      </a>
      <button type="button" onClick={copy} className={btnClass}>
        {copied ? (
          <>
            <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            Copied
          </>
        ) : (
          "Copy Link"
        )}
      </button>
      <a
        href={ogHref}
        download="rapid-cortex-preview.png"
        target="_blank"
        rel="noopener noreferrer"
        className={btnClass}
      >
        <Download className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
        Download One-Pager
      </a>
    </div>
  );
}

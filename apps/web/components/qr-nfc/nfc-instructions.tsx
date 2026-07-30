"use client";

import { useState } from "react";

type Props = {
  url: string;
};

export function NFCInstructions({ url }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyUrl() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300">
      <h3 className="font-semibold text-slate-100">How to program an NFC tag</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>Order NTAG213 NFC stickers (about $15–20 per 100 tags).</li>
        <li>Open the Rapid Cortex mobile app (Campus or Venue).</li>
        <li>Open this code, then tap Program NFC Tag.</li>
        <li>Hold an NTAG213 to the back of your mobile device until the write succeeds.</li>
        <li>Stick the programmed tag to the back of your sign.</li>
      </ol>
      <p className="mt-3 text-xs text-slate-500">
        The app writes this URL to the tag (no paste needed):
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="break-all rounded bg-slate-950 px-2 py-1 text-xs text-emerald-300">{url}</code>
        <button
          type="button"
          onClick={() => void copyUrl()}
          className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800"
        >
          {copied ? "Copied" : "Copy URL"}
        </button>
      </div>
      {copyError ? (
        <p className="mt-1 text-xs text-rose-400">Clipboard blocked — select and copy the URL manually.</p>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        Any modern iPhone (7+) or Android can read the tag. No app download needed for the person reporting.
      </p>
    </section>
  );
}

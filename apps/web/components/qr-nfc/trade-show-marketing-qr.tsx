"use client";

import { useEffect, useState } from "react";
import {
  TRADE_SHOW_DESTINATIONS,
  isTradeShowMarketingUrl,
  tradeShowQrFileName,
  tradeShowScanUrl,
  tradeShowUrlFor,
  type TradeShowDestinationId,
} from "rapid-cortex-shared";

type Props = {
  onCopied?: (label: string) => void;
  onDownloaded?: (fileName: string) => void;
  onError?: (message: string) => void;
};

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("Clipboard copy failed");
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

export function TradeShowMarketingQrPanel({ onCopied, onDownloaded, onError }: Props) {
  const [destination, setDestination] = useState<TradeShowDestinationId>("home");
  const destinationUrl = tradeShowUrlFor(destination);
  const url = tradeShowScanUrl(destination, "qr");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    void (async () => {
      if (!isTradeShowMarketingUrl(url)) return;
      try {
        const qrMod = await import("qrcode");
        const toDataURL =
          typeof qrMod.toDataURL === "function" ? qrMod.toDataURL : qrMod.default.toDataURL;
        const next = await toDataURL(url, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: "H",
          color: { dark: "#0B1220", light: "#FFFFFF" },
        });
        if (!cancelled) setDataUrl(next);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  function handleDownload() {
    if (!dataUrl) return;
    const fileName = tradeShowQrFileName(destination);
    downloadDataUrl(dataUrl, fileName);
    onDownloaded?.(fileName);
  }

  async function handleCopy() {
    try {
      await copyText(url);
      onCopied?.("Marketing URL");
    } catch {
      onError?.("Could not copy URL.");
    }
  }

  return (
    <section
      id="rc-marketing-qr"
      className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">
        Rapid Cortex site QR
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        Booth and Rapid Cortex marketing signs. Choose Home or Demo, download the PNG, and print it.
        Scans are counted, then the visitor lands on the public site. Do not use + New QR / NFC Code —
        that opens a location report form. Program the matching NFC tag in Rapid Cortex Mobile while
        signed in with an RC account (Codes → globe, or Settings → Rapid Cortex site QR & NFC).
      </p>

      <div className="mt-3 flex gap-2" role="tablist" aria-label="Rapid Cortex site destination">
        {TRADE_SHOW_DESTINATIONS.map((dest) => {
          const selected = dest.id === destination;
          return (
            <button
              key={dest.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDestination(dest.id)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
                selected
                  ? "border-amber-500 bg-slate-950 text-amber-300"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              {dest.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-center font-mono text-xs text-amber-200/90">
        {destinationUrl.replace(/^https:\/\//, "")}
      </p>
      <p className="mt-1 text-center text-[11px] text-slate-500">
        QR encodes a tracked link so every website click is counted.
      </p>

      <div className="mt-4 flex justify-center">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR code for ${url}`}
            width={200}
            height={200}
            className="h-[200px] w-[200px] rounded bg-white p-2 object-contain"
          />
        ) : (
          <div className="h-[200px] w-[200px] animate-pulse rounded bg-slate-800" aria-hidden />
        )}
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">Print at least 2″ on wall signs.</p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!dataUrl}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          Download PNG
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-sky-500/60"
        >
          Copy URL
        </button>
        <button
          type="button"
          onClick={() => window.open(destinationUrl, "_blank", "noopener,noreferrer")}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-sky-500/60"
        >
          Open page
        </button>
      </div>
    </section>
  );
}

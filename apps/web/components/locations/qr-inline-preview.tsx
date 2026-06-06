"use client";

import { Copy, Download, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { qrReportUrl } from "rapid-cortex-shared";
import { qrAssetUrl } from "@/lib/locations-api";

type QrInlinePreviewProps = {
  rcli: string;
  agencyId: string;
  locationName: string;
  zoneCode: string;
  size?: number;
};

export function QrInlinePreview({
  rcli,
  agencyId,
  locationName,
  zoneCode,
  size = 48,
}: QrInlinePreviewProps) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [full, setFull] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const QRCode = await import("qrcode");
      const url = qrReportUrl(rcli, "prod");
      const dataUrl = await QRCode.toDataURL(url, {
        width: size,
        margin: 1,
        color: { dark: "#1B3A6B", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });
      if (!cancelled) setThumb(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [rcli, size]);

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    void (async () => {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(qrReportUrl(rcli, "prod"), {
        width: 256,
        margin: 2,
        color: { dark: "#1B3A6B", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });
      if (!cancelled) setFull(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, rcli]);

  const reportUrl = qrReportUrl(rcli, "prod");

  return (
    <>
      <button type="button" onClick={() => setModalOpen(true)} className="rounded border border-slate-700 p-1">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={`QR ${rcli}`} width={size} height={size} className="block" />
        ) : (
          <span className="inline-block h-12 w-12 animate-pulse bg-slate-800" />
        )}
      </button>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-950 p-5 text-center">
            {full ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={full} alt={`QR ${rcli}`} className="mx-auto h-64 w-64" />
            ) : (
              <div className="mx-auto h-64 w-64 animate-pulse bg-slate-800" />
            )}
            <p className="mt-3 text-sm font-semibold text-white">{locationName}</p>
            <p className="text-sm text-sky-300">Zone {zoneCode}</p>
            <p className="mt-1 font-mono text-[10px] text-slate-500">{rcli}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(reportUrl)}
                className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs"
              >
                <Copy className="h-3 w-3" />
                Copy URL
              </button>
              <a
                href={qrAssetUrl(agencyId, rcli, "png", 512)}
                className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs"
              >
                <Download className="h-3 w-3" />
                PNG
              </a>
              <a
                href={qrAssetUrl(agencyId, rcli, "pdf")}
                className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs"
              >
                <Download className="h-3 w-3" />
                PDF
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs"
              >
                <Printer className="h-3 w-3" />
                Print
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { use, useMemo } from "react";
import { Info, QrCode } from "lucide-react";
import { FIXTURE_ZONES } from "../_lib/venue-fixtures";

export default function VenueQrCodesPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  const zones = useMemo(() => FIXTURE_ZONES, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">QR Codes</h1>
          <p className="mt-1 text-sm text-slate-400">
            One QR code per zone. Post at entrances, sections, and concourses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => console.log("TODO: download all QR codes as PDF")}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Download All QR Codes (PDF)
        </button>
      </div>

      <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-4">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-5 w-5 text-sky-300" />
          <p className="text-sm text-sky-100">
            Each QR code links directly to rapidcortex.us/report/{venueCode}/{"{zoneCode}"}. Guests can
            submit a report without creating an account or downloading an app.
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((zone) => {
          const reportUrl = `/report/${venueCode}/${zone.code}`;
          return (
            <article
              key={zone.id}
              className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4"
            >
              <p className="font-mono text-xl font-bold text-sky-300">{zone.code}</p>
              <p className="mt-1 text-sm text-slate-300">{zone.label}</p>

              <div className="mt-3 flex h-[120px] w-[120px] items-center justify-center rounded-md border border-slate-700 bg-slate-800/70">
                <QrCode className="h-8 w-8 text-slate-500" />
              </div>

              <p className="mt-3 break-all text-xs text-slate-400">{reportUrl}</p>
              <span
                className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${
                  zone.activeIncidents > 0
                    ? "border-red-500/30 bg-red-500/15 text-red-300"
                    : "border-slate-700 bg-slate-900 text-slate-300"
                }`}
              >
                {zone.activeIncidents} active incidents
              </span>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => console.log("TODO: download QR", zone.code)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(reportUrl);
                    console.log("Copied URL", reportUrl);
                  }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Copy URL
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

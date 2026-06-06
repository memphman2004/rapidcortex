"use client";

import { CheckCircle2, MapPin, Phone } from "lucide-react";
import { HELP_TYPES, type HelpType } from "../_lib/report-types";

export function StepConfirmed({
  referenceId,
  helpType,
  zoneLabel,
  venueCode,
}: {
  referenceId: string;
  helpType: HelpType;
  zoneLabel: string;
  venueCode: string;
}) {
  const helpTypeMeta = HELP_TYPES.find((item) => item.type === helpType);

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center py-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 animate-in zoom-in duration-300">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
      </div>

      <h1 className="mt-6 text-3xl font-bold text-slate-800">Help is on the way</h1>
      <p className="mt-2 text-slate-500">Security has been notified and is responding.</p>

      <div className="mt-6 w-full rounded-xl bg-slate-50 p-4 text-center">
        <p className="text-xs text-slate-400">Reference number</p>
        <p className="mt-1 font-mono text-lg font-semibold text-slate-700">{referenceId}</p>
        <p className="mt-1 text-xs text-slate-400">Screenshot this for your records.</p>
      </div>

      <div className="mt-4 w-full rounded-xl border border-slate-200 bg-white p-4 text-left">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <span>{helpTypeMeta?.emoji ?? "❓"}</span>
          <span>{helpTypeMeta?.label ?? "Request"}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <MapPin className="h-4 w-4 text-slate-500" />
          <span>{zoneLabel || venueCode}</span>
        </div>
      </div>

      <div className="mt-8 w-full rounded-xl border border-red-200 bg-red-50 p-4 text-left">
        <div className="flex items-start gap-2">
          <Phone className="mt-0.5 h-4 w-4 text-red-500" />
          <p className="text-sm font-medium text-red-700">
            If this is a life-threatening emergency, call 911 immediately.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 min-h-12 text-sm font-medium text-blue-600"
      >
        Submit another report
      </button>
    </section>
  );
}

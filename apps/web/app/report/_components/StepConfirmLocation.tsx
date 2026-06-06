"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, MapPin } from "lucide-react";
import type { HelpType } from "../_lib/report-types";
import { HELP_TYPES } from "../_lib/report-types";
import { ReportProgress } from "./ReportProgress";

function venueLabelFromCode(venueCode: string): string {
  if (venueCode === "MBS") return "Mercedes-Benz Stadium";
  return venueCode;
}

export function StepConfirmLocation({
  venueCode,
  zoneCode,
  zoneLabel,
  helpType,
  onConfirm,
  onBack,
}: {
  venueCode: string;
  zoneCode: string;
  zoneLabel: string;
  helpType: HelpType;
  onConfirm: (zoneLabelValue: string) => void;
  onBack: () => void;
}) {
  const [localZoneLabel, setLocalZoneLabel] = useState(zoneLabel);
  const helpTypeMeta = useMemo(() => HELP_TYPES.find((item) => item.type === helpType), [helpType]);
  const canContinue = localZoneLabel.trim().length > 0;

  return (
    <section className="flex min-h-[70vh] flex-col justify-between">
      <div>
        <ReportProgress step={2} total={4} />
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-12 items-center gap-1 text-sm text-slate-500"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-2xl font-semibold text-slate-800">Where are you?</h1>

        <div className="mt-4 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <p className="text-lg font-semibold text-slate-800">
              {localZoneLabel || zoneCode || "Location needed"}
            </p>
          </div>
          <p className="mt-1 text-sm text-slate-500">{venueLabelFromCode(venueCode)}</p>
        </div>

        <div className="mt-4">
          <label htmlFor="zoneLabel" className="mb-2 block text-sm text-slate-600">
            Not right? Update your location
          </label>
          <input
            id="zoneLabel"
            value={localZoneLabel}
            onChange={(event) => setLocalZoneLabel(event.target.value)}
            placeholder="e.g. Gate B, Concourse 3, Food Court"
            className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-base text-slate-700 outline-none focus:border-blue-400"
          />
        </div>

        {helpTypeMeta ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            <span>{helpTypeMeta.emoji}</span>
            <span>{helpTypeMeta.label}</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onConfirm(localZoneLabel.trim())}
        disabled={!canContinue}
        className="mt-6 min-h-14 w-full rounded-xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        Continue →
      </button>
    </section>
  );
}

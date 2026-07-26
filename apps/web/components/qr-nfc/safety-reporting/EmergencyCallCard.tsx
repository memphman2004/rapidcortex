"use client";

import { AlertTriangle, Phone } from "lucide-react";
import { useReportLanguage } from "@/components/intake/report-language";
import { SAFETY_BRAND } from "./tokens";

type EmergencyCallCardProps = {
  callLabel: string;
  callNumber?: string;
  callNumberDisplay?: string;
};

export function EmergencyCallCard({ callLabel, callNumber, callNumberDisplay }: EmergencyCallCardProps) {
  const { t } = useReportLanguage();
  if (!callNumber) return null;

  return (
    <section
      className="rounded-2xl border bg-white p-4"
      style={{
        borderColor: SAFETY_BRAND.border,
        boxShadow: SAFETY_BRAND.cardShadow,
      }}
    >
      <a
        href={`tel:${callNumber}`}
        className="flex min-h-[3.5rem] w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 text-center text-white no-underline transition active:scale-[0.99]"
        style={{ backgroundColor: SAFETY_BRAND.actionGreen }}
        aria-label={`${callLabel}${callNumberDisplay ? `, ${callNumberDisplay}` : ""}`}
      >
        <Phone className="h-5 w-5 shrink-0 text-white" aria-hidden />
        <span className="min-w-0">
          <span className="block text-base font-bold tracking-wide">{callLabel}</span>
          {callNumberDisplay ? (
            <span className="mt-0.5 block text-sm font-medium text-white/90">{callNumberDisplay}</span>
          ) : null}
        </span>
      </a>
      <p
        className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs leading-snug"
        style={{ color: SAFETY_BRAND.muted }}
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: SAFETY_BRAND.rapidRed }} aria-hidden />
        {t("lifeThreat")}
      </p>
    </section>
  );
}

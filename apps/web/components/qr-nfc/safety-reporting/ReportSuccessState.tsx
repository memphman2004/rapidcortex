"use client";

import { CheckCircle2 } from "lucide-react";
import { useReportLanguage } from "@/components/intake/report-language";
import { intakePageBackgroundStyle } from "@/components/intake/vertical-theme";
import { SAFETY_BRAND } from "./tokens";
import { StickyEmergencyFooter } from "./StickyEmergencyFooter";

type ReportSuccessStateProps = {
  vertical?: string;
  referenceCode?: string | null;
  title?: string;
  description?: string;
};

export function ReportSuccessState({
  vertical,
  referenceCode,
  title,
  description,
}: ReportSuccessStateProps) {
  const { t } = useReportLanguage();
  const pageBackground =
    (vertical ? intakePageBackgroundStyle(vertical) : null) ??
    ({
      background: `linear-gradient(180deg, ${SAFETY_BRAND.lightBg} 0%, #EEF3FA 100%)`,
    } as const);

  const usesPhotoBg = Boolean(vertical && intakePageBackgroundStyle(vertical));

  return (
    <div className="flex min-h-[100dvh] flex-col" style={pageBackground}>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 pb-24 pt-10 text-center">
        <div
          className={
            usesPhotoBg
              ? "w-full rounded-2xl border bg-white px-5 py-8 shadow-lg"
              : "w-full"
          }
          style={usesPhotoBg ? { borderColor: SAFETY_BRAND.border, boxShadow: SAFETY_BRAND.cardShadow } : undefined}
        >
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: `${SAFETY_BRAND.actionGreen}1A` }}
            aria-hidden
          >
            <CheckCircle2 className="h-9 w-9" style={{ color: SAFETY_BRAND.actionGreen }} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight" style={{ color: SAFETY_BRAND.textDark }}>
            {title ?? t("campusSuccessTitle")}
          </h1>
          <p className="mt-2 max-w-sm mx-auto text-sm leading-relaxed" style={{ color: SAFETY_BRAND.muted }}>
            {description ?? t("campusSuccessDesc")}
          </p>
          {referenceCode ? (
            <p
              className="mt-5 rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
            >
              <span className="font-mono font-semibold tracking-wide">{referenceCode}</span>
            </p>
          ) : null}
          <p className="mt-6 text-xs" style={{ color: SAFETY_BRAND.muted }}>
            {t("lifeThreat")}
          </p>
        </div>
      </main>
      <StickyEmergencyFooter />
    </div>
  );
}

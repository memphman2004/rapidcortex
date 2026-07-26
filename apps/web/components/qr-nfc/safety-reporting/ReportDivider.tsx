"use client";

import { useReportLanguage } from "@/components/intake/report-language";
import { SAFETY_BRAND } from "./tokens";

type ReportDividerProps = {
  label?: string;
};

export function ReportDivider({ label }: ReportDividerProps) {
  const { t } = useReportLanguage();
  const text = label ?? t("orSubmit");
  return (
    <div className="flex items-center gap-3 px-1" role="separator" aria-label={text}>
      <div className="h-px flex-1" style={{ backgroundColor: SAFETY_BRAND.border }} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: SAFETY_BRAND.muted }}>
        {text}
      </span>
      <div className="h-px flex-1" style={{ backgroundColor: SAFETY_BRAND.border }} />
    </div>
  );
}

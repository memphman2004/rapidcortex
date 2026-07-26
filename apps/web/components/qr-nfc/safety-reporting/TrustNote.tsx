"use client";

import { Lock } from "lucide-react";
import { useReportLanguage } from "@/components/intake/report-language";
import { SAFETY_BRAND } from "./tokens";

export function TrustNote() {
  const { t } = useReportLanguage();
  return (
    <p
      className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
      style={{
        color: SAFETY_BRAND.muted,
        backgroundColor: `${SAFETY_BRAND.deepBlue}0A`,
      }}
    >
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: SAFETY_BRAND.deepBlue }} aria-hidden />
      <span>{t("securityNotice")}</span>
    </p>
  );
}

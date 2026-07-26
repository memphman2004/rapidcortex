"use client";

import { useReportLanguage } from "@/components/intake/report-language";
import { SAFETY_BRAND } from "./tokens";

type StickyEmergencyFooterProps = {
  brandDomain?: string;
};

export function StickyEmergencyFooter({ brandDomain }: StickyEmergencyFooterProps) {
  const { t } = useReportLanguage();
  const domain = brandDomain ?? t("brandDomain");
  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md"
      style={{
        borderColor: "rgba(226, 232, 240, 0.9)",
        backgroundColor: "rgba(255, 255, 255, 0.94)",
        paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5">
        <a
          href="tel:911"
          className="text-xs font-semibold no-underline"
          style={{ color: SAFETY_BRAND.rapidRed }}
          aria-label={t("emergencyFooter")}
        >
          {t("emergencyFooter")}
        </a>
        <span className="text-[11px] font-medium" style={{ color: SAFETY_BRAND.muted }}>
          {domain}
        </span>
      </div>
    </footer>
  );
}

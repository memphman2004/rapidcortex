"use client";

import Image from "next/image";
import { Lock } from "lucide-react";
import { useReportLanguage } from "@/components/intake/report-language";
import { LanguageSelector } from "./LanguageSelector";
import { SAFETY_BRAND } from "./tokens";

type SafetyHeaderProps = {
  productLabel: string;
};

export function SafetyHeader({ productLabel }: SafetyHeaderProps) {
  const { t } = useReportLanguage();
  return (
    <header
      className="relative overflow-hidden px-4 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))]"
      style={{
        background: `linear-gradient(145deg, ${SAFETY_BRAND.navy} 0%, ${SAFETY_BRAND.navyDeep} 48%, ${SAFETY_BRAND.deepBlue} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
        style={{ backgroundColor: SAFETY_BRAND.rapidRed }}
        aria-hidden
      />
      <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/Logo/nowordslogo.png"
            alt="Rapid Cortex"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 object-contain"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-white">{productLabel}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-300">
              <Lock className="h-3 w-3" aria-hidden />
              {t("secureReporting")}
            </p>
          </div>
        </div>
        <LanguageSelector variant="dark" />
      </div>
    </header>
  );
}

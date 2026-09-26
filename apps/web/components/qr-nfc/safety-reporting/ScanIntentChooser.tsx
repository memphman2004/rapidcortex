"use client";

import type { ReactNode } from "react";
import { Info, Phone, Shield } from "lucide-react";
import { useReportLanguage } from "@/components/intake/report-language";
import { intakePageBackgroundStyle } from "@/components/intake/vertical-theme";
import { guestAssistUrl } from "@/lib/qr-nfc/guest-assist-url";
import { SAFETY_BRAND } from "./tokens";
import { SafetyHeader } from "./SafetyHeader";
import { SafetyHeroCard } from "./SafetyHeroCard";

export type ScanIntentChooserProps = {
  productLabel: string;
  contextLabel: string;
  reportingPointName: string;
  locationDetails?: string;
  vertical: string;
  agencyId?: string;
  guestAssistEnabled: boolean;
  onPoliceSecurity: () => void;
};

export function ScanIntentChooser({
  productLabel,
  contextLabel,
  reportingPointName,
  locationDetails,
  vertical,
  agencyId,
  guestAssistEnabled,
  onPoliceSecurity,
}: ScanIntentChooserProps) {
  const { t, dir, code: langCode } = useReportLanguage();
  const pageBackground =
    intakePageBackgroundStyle(vertical) ??
    ({
      background: `linear-gradient(180deg, ${SAFETY_BRAND.lightBg} 0%, #EEF3FA 55%, ${SAFETY_BRAND.lightBg} 100%)`,
    } as const);

  function openInformation() {
    const backPath =
      typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined;
    window.location.assign(
      guestAssistUrl({
        vertical,
        agencyName: reportingPointName,
        location: locationDetails ?? "",
        agencyId,
        backPath,
      }),
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      dir={dir}
      lang={langCode.toLowerCase()}
      style={pageBackground}
    >
      <SafetyHeader productLabel={productLabel} />
      <main className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pb-10 pt-3">
        <SafetyHeroCard
          compact
          contextLabel={contextLabel}
          reportingPointName={reportingPointName}
          locationDetails={locationDetails}
          headline={t("scanChooserTitle")}
          supporting={t("scanChooserDesc")}
        />

        <div className="grid gap-3">
          {guestAssistEnabled ? (
            <IntentButton
              label={t("scanChooserInfo")}
              hint={t("scanChooserInfoHint")}
              icon={<Info className="h-6 w-6" aria-hidden />}
              onClick={openInformation}
              tone="info"
            />
          ) : null}
          <IntentButton
            label={t("scanChooserPolice")}
            hint={t("scanChooserPoliceHint")}
            icon={<Shield className="h-6 w-6" aria-hidden />}
            onClick={onPoliceSecurity}
            tone="security"
          />
          <a
            href="tel:911"
            className="flex min-h-[4.5rem] items-center gap-4 rounded-2xl border-2 px-4 py-3.5 no-underline transition active:scale-[0.99]"
            style={{
              borderColor: "#FECACA",
              backgroundColor: SAFETY_BRAND.rapidRed,
              color: SAFETY_BRAND.white,
              boxShadow: `0 0 0 3px ${SAFETY_BRAND.rapidRed}, ${SAFETY_BRAND.cardShadow}`,
            }}
            aria-label={t("scanChooserEmergency")}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15"
              aria-hidden
            >
              <Phone className="h-6 w-6" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-lg font-semibold">{t("scanChooserEmergency")}</span>
              <span className="mt-0.5 block text-sm font-medium text-white/85">
                {t("scanChooserEmergencyHint")}
              </span>
            </span>
          </a>
        </div>

        <p className="pt-2 text-center text-xs" style={{ color: SAFETY_BRAND.muted }}>
          {t("scanChooserDisclaimer")}
        </p>
      </main>
    </div>
  );
}

function IntentButton({
  label,
  hint,
  icon,
  onClick,
  tone,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
  tone: "info" | "security";
}) {
  const isInfo = tone === "info";
  const ring = isInfo ? "#0284C7" : "#F59E0B";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex min-h-[4.5rem] items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition active:scale-[0.99]"
      style={{
        borderColor: ring,
        backgroundColor: isInfo ? SAFETY_BRAND.white : SAFETY_BRAND.navy,
        color: isInfo ? SAFETY_BRAND.textDark : SAFETY_BRAND.white,
        boxShadow: `0 0 0 3px ${isInfo ? "rgba(2,132,199,0.35)" : "rgba(245,158,11,0.45)"}, ${SAFETY_BRAND.cardShadow}`,
      }}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: isInfo ? `${SAFETY_BRAND.deepBlue}14` : "rgba(255,255,255,0.12)",
          color: isInfo ? SAFETY_BRAND.deepBlue : SAFETY_BRAND.white,
        }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold">{label}</span>
        <span
          className="mt-0.5 block text-sm font-medium"
          style={{ color: isInfo ? SAFETY_BRAND.muted : "rgba(255,255,255,0.78)" }}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}

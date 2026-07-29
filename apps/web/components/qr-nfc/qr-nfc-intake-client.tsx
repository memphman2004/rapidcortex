"use client";

import { useState } from "react";
import type { QRNFCPublicRecord, ReportMedium } from "rapid-cortex-shared";
import { qrNfcCallButtonLabel } from "rapid-cortex-shared";
import {
  ReportLanguageProvider,
  useReportLanguage,
} from "@/components/intake/report-language";
import { intakePageBackgroundStyle } from "@/components/intake/vertical-theme";
import {
  EmergencyCallCard,
  ReportDivider,
  ReportForm,
  ReportSuccessState,
  SafetyHeader,
  SafetyHeroCard,
  StickyEmergencyFooter,
  SAFETY_BRAND,
  safetyConfigForVertical,
  type ReportFormValues,
} from "./safety-reporting";

type Props = {
  record: QRNFCPublicRecord;
  medium: ReportMedium;
};

export function QRNfcIntakeClient(props: Props) {
  return (
    <ReportLanguageProvider>
      <QRNfcIntakeClientInner {...props} />
    </ReportLanguageProvider>
  );
}

function QRNfcIntakeClientInner({ record, medium }: Props) {
  const { t, dir, code: langCode } = useReportLanguage();
  const config = safetyConfigForVertical(record.vertical);
  const isCampus = record.vertical === "campus";
  const isVenue = record.vertical === "venue";

  const [values, setValues] = useState<ReportFormValues>({
    message: "",
    locationNote: record.zoneName ?? "",
    reporterName: "",
    reporterPhone: "",
    anonymous: record.reportType === "anonymous",
    category: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showIdentity =
    record.reportType === "identified" || (record.reportType === "both" && !values.anonymous);

  const productLabel = isCampus
    ? t("campusHeader")
    : isVenue
      ? t("venueHeader")
      : config.productLabel;
  const contextLabel = isCampus
    ? t("campusAgencyLabel")
    : isVenue
      ? t("venueAgencyLabel")
      : config.contextLabel;
  const headline = isCampus ? t("campusTitle") : isVenue ? t("venueTitle") : config.headline;
  const supporting = isCampus ? t("campusDesc") : isVenue ? t("venueDesc") : config.supporting;
  const callFallback = isCampus
    ? t("campusCall")
    : isVenue
      ? t("venueCall")
      : config.callButtonFallback;
  const callLabel = qrNfcCallButtonLabel(record.vertical) || callFallback;
  const locationFieldLabel = t("locationZone");
  const submitLabel = t("submitReport");
  const categoryLabels =
    isCampus && config.categories.length === 6
      ? config.categories.map((_, i) => t(`cat.campus.${i}`))
      : isVenue && config.categories.length === 6
        ? config.categories.map((_, i) => t(`cat.venue.${i}`))
        : config.categories;

  function patchValues(patch: Partial<ReportFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = values.message.trim();
    if (!trimmed) {
      setError(t("whatHappeningError"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Category is UI-only: prepend into message so existing public report schema stays unchanged.
      // Store English category values from config so ops queues stay language-stable.
      const message = values.category ? `[${values.category}] ${trimmed}` : trimmed;

      const res = await fetch("/api/public/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrId: record.qrId,
          message,
          locationNote: values.locationNote || undefined,
          reporterName: showIdentity ? values.reporterName || undefined : undefined,
          reporterPhone: showIdentity ? values.reporterPhone || undefined : undefined,
          medium,
        }),
      });
      const body = (await res.json()) as { referenceCode?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Please check your connection and try again.");
      setReferenceCode(body.referenceCode ?? null);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const pageBackground =
    intakePageBackgroundStyle(record.vertical) ??
    ({
      background: `linear-gradient(180deg, ${SAFETY_BRAND.lightBg} 0%, #EEF3FA 55%, ${SAFETY_BRAND.lightBg} 100%)`,
    } as const);

  if (submitted) {
    return (
      <div dir={dir} lang={langCode.toLowerCase()}>
        <ReportSuccessState
          vertical={record.vertical}
          referenceCode={referenceCode}
          title={isVenue ? t("venueSuccessTitle") : t("campusSuccessTitle")}
          description={isVenue ? t("venueSuccessDesc") : t("campusSuccessDesc")}
        />
      </div>
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

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pb-28 pt-4">
        <SafetyHeroCard
          contextLabel={contextLabel}
          agencyName={record.agencyName}
          zoneName={record.zoneName}
          headline={headline}
          supporting={supporting}
        />

        {record.callNumber ? (
          <>
            <EmergencyCallCard
              callLabel={callLabel}
              callNumber={record.callNumber}
              callNumberDisplay={record.callNumberDisplay}
            />
            <ReportDivider />
          </>
        ) : null}

        <ReportForm
          values={values}
          onChange={patchValues}
          categories={config.categories}
          categoryLabels={categoryLabels}
          locationFieldLabel={locationFieldLabel}
          locationPlaceholder={config.defaultLocationPlaceholder}
          submitLabel={submitLabel}
          showAnonymousToggle={record.reportType === "both"}
          showIdentity={showIdentity}
          submitting={submitting}
          error={error}
          onSubmit={(e) => void onSubmit(e)}
        />
      </main>

      <StickyEmergencyFooter />
    </div>
  );
}

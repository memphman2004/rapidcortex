"use client";

import { useState } from "react";
import type { QRNFCPublicRecord, ReportMedium } from "rapid-cortex-shared";
import {
  formatK12FollowUpAnswers,
  getK12FollowUpQuestions,
  qrNfcCallButtonLabel,
} from "rapid-cortex-shared";
import {
  ReportLanguageProvider,
  useReportLanguage,
} from "@/components/intake/report-language";
import { intakePageBackgroundStyle } from "@/components/intake/vertical-theme";
import { isGuestAssistEnabled } from "@/lib/runtime-flags";
import { CampusAlertsRegistration } from "@/components/qr-nfc/campus-alerts-registration";
import { CampusInfoTabPanel } from "@/components/qr-nfc/campus-info-tab-panel";
import { CampusLiveLocationShare } from "@/components/qr-nfc/campus-live-location-share";
import { EscortIqLanding } from "@/components/qr-nfc/escort-iq/escort-iq-landing";
import {
  EmergencyCallCard,
  ReportDivider,
  ReportForm,
  ReportSuccessState,
  SafetyHeader,
  SafetyHeroCard,
  ScanIntentChooser,
  StickyEmergencyFooter,
  SAFETY_BRAND,
  safetyConfigForVertical,
  type ReportFormMediaFile,
  type ReportFormValues,
} from "./safety-reporting";

async function uploadPublicReportMedia(qrId: string, file: File): Promise<string | null> {
  const isVideo = file.type.startsWith("video/");
  const mediaType = isVideo ? "video" : "image";
  const presignRes = await fetch(
    `/api/public/report/media-upload-url?qrId=${encodeURIComponent(qrId)}&type=${mediaType}`,
  );
  if (!presignRes.ok) return null;
  const presign = (await presignRes.json()) as {
    uploadUrl?: string;
    key?: string;
    contentType?: string;
  };
  if (!presign.uploadUrl || !presign.key) return null;
  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": presign.contentType ?? (isVideo ? "video/mp4" : "image/jpeg") },
    body: file,
  });
  if (!putRes.ok) return null;
  return presign.key;
}

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
  const isCampus = record.vertical === "campus";
  const isVenue = record.vertical === "venue";
  const isK12 = isCampus && record.institutionType === "k12";
  const config = safetyConfigForVertical(record.vertical, {
    institutionType: isCampus ? record.institutionType : undefined,
  });

  const [values, setValues] = useState<ReportFormValues>({
    message: "",
    locationNote: record.zoneName ?? "",
    reporterName: "",
    reporterPhone: "",
    anonymous: record.reportType === "anonymous",
    category: null,
    followUpAnswers: {},
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [screen, setScreen] = useState<"chooser" | "report" | "escort" | "campus-alerts">(
    "chooser",
  );
  const [intakeTab, setIntakeTab] = useState<"info" | "report">(
    isCampus && record.infoTab ? "info" : "report",
  );
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<ReportFormMediaFile | null>(null);

  const showIdentity =
    record.reportType === "identified" || (record.reportType === "both" && !values.anonymous);
  const collectPhone = isCampus && record.collectPhone !== false;

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
    isCampus && !isK12 && config.categories.length === 6
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
    if (shareLiveLocation && !values.reporterPhone.trim()) {
      setError("Enter a callback phone number to share your location.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let prefix = "";
      if (isK12 && values.category) {
        const typeMeta = config.k12Types?.find((x) => x.value === values.category);
        const label = typeMeta?.label ?? values.category;
        const followUpText = formatK12FollowUpAnswers(
          values.followUpAnswers ?? {},
          getK12FollowUpQuestions(values.category),
        );
        prefix = followUpText
          ? `[${label}]\n${followUpText}\n\n`
          : `[${label}] `;
      } else if (values.category) {
        prefix = `[${values.category}] `;
      }
      const message = `${prefix}${trimmed}`;

      const mediaKeys: string[] = [];
      if (mediaFile) {
        const key = await uploadPublicReportMedia(record.qrId, mediaFile.file);
        if (!key) {
          throw new Error("Could not upload photo/video. Try again or submit without media.");
        }
        mediaKeys.push(key);
      }

      const res = await fetch("/api/public/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrId: record.qrId,
          message,
          locationNote: values.locationNote || undefined,
          reporterName: showIdentity ? values.reporterName || undefined : undefined,
          reporterPhone:
            showIdentity || collectPhone || shareLiveLocation
              ? values.reporterPhone || undefined
              : undefined,
          medium,
          ...(mediaKeys.length ? { mediaKeys } : {}),
          ...(isCampus && shareLiveLocation ? { shareLiveLocation: true } : {}),
        }),
      });
      const body = (await res.json()) as {
        referenceCode?: string;
        trackingToken?: string;
        liveLocationToken?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Please check your connection and try again.");
      setReferenceCode(body.referenceCode ?? null);
      setTrackingToken(body.trackingToken ?? body.liveLocationToken ?? null);
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
        >
          {trackingToken ? <CampusLiveLocationShare token={trackingToken} /> : null}
        </ReportSuccessState>
      </div>
    );
  }

  const reportingPointName = record.name?.trim() || record.agencyName;
  const locationDetails = record.zoneName?.trim() || undefined;
  const locationLabel = [reportingPointName, locationDetails].filter(Boolean).join(" — ");

  if (screen === "chooser") {
    return (
      <ScanIntentChooser
        productLabel={productLabel}
        contextLabel={contextLabel}
        reportingPointName={reportingPointName}
        locationDetails={locationDetails}
        vertical={record.vertical}
        agencyId={record.agencyId}
        guestAssistEnabled={isGuestAssistEnabled()}
        escortIqAvailable={Boolean(isCampus && record.escortIqAvailable)}
        onPoliceSecurity={() => setScreen("report")}
        onEscortIq={() => setScreen("escort")}
      />
    );
  }

  if (screen === "escort" && isCampus && record.escortIqAvailable) {
    return (
      <EscortIqLanding
        qrId={record.qrId}
        medium={medium === "sms" ? "url" : medium}
        callNumber={record.callNumber}
        locationLabel={locationLabel}
        onBack={() => setScreen("chooser")}
      />
    );
  }

  if (screen === "campus-alerts" && isCampus && record.campusAlertsAvailable) {
    return (
      <div
        className="flex min-h-[100dvh] flex-col"
        dir={dir}
        lang={langCode.toLowerCase()}
        style={pageBackground}
      >
        <SafetyHeader productLabel={productLabel} />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-4">
          <CampusAlertsRegistration
            qrId={record.qrId}
            medium={medium === "sms" ? "direct" : medium}
            universityNameHint={record.agencyName}
            onBack={() => {
              setScreen("report");
              setIntakeTab("info");
            }}
          />
        </main>
        <StickyEmergencyFooter />
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
      <div className="mx-auto w-full max-w-lg px-4 pt-3">
        <button
          type="button"
          onClick={() => setScreen("chooser")}
          className="min-h-11 text-sm font-semibold"
          style={{ color: SAFETY_BRAND.deepBlue }}
        >
          ← {t("scanChooserBack")}
        </button>
      </div>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pb-28 pt-4">
        <SafetyHeroCard
          contextLabel={contextLabel}
          reportingPointName={reportingPointName}
          locationDetails={locationDetails}
          headline={headline}
          supporting={supporting}
        />

        {isCampus && record.infoTab ? (
          <div
            className="flex gap-1 rounded-xl border p-1"
            style={{ borderColor: SAFETY_BRAND.border, backgroundColor: "#fff" }}
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={intakeTab === "info"}
              onClick={() => setIntakeTab("info")}
              className="min-h-10 flex-1 rounded-lg text-sm font-semibold"
              style={{
                backgroundColor: intakeTab === "info" ? SAFETY_BRAND.deepBlue : "transparent",
                color: intakeTab === "info" ? "#fff" : SAFETY_BRAND.textDark,
              }}
            >
              Information
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={intakeTab === "report"}
              onClick={() => setIntakeTab("report")}
              className="min-h-10 flex-1 rounded-lg text-sm font-semibold"
              style={{
                backgroundColor: intakeTab === "report" ? SAFETY_BRAND.deepBlue : "transparent",
                color: intakeTab === "report" ? "#fff" : SAFETY_BRAND.textDark,
              }}
            >
              Report
            </button>
          </div>
        ) : null}

        {isCampus && record.infoTab && intakeTab === "info" ? (
          <CampusInfoTabPanel
            infoTab={record.infoTab}
            locationLabel={locationLabel}
            campusAlertsAvailable={Boolean(record.campusAlertsAvailable)}
            onRegisterCampusAlerts={
              record.campusAlertsAvailable ? () => setScreen("campus-alerts") : undefined
            }
          />
        ) : (
          <>
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
              k12Types={isK12 ? config.k12Types : undefined}
              locationFieldLabel={locationFieldLabel}
              locationPlaceholder={config.defaultLocationPlaceholder}
              submitLabel={submitLabel}
              showAnonymousToggle={record.reportType === "both"}
              showIdentity={showIdentity}
              showCallbackPhone={collectPhone && !showIdentity}
              shareLiveLocation={isCampus ? shareLiveLocation : false}
              onShareLiveLocationChange={isCampus ? setShareLiveLocation : undefined}
              submitting={submitting}
              error={error}
              onSubmit={(e) => void onSubmit(e)}
              showOptionalActions
              mediaFile={mediaFile}
              onMediaFileChange={setMediaFile}
            />
          </>
        )}
      </main>

      <StickyEmergencyFooter />
    </div>
  );
}

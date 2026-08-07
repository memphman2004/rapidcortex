"use client";

import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Camera,
  Check,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import type { QRLocationPublic } from "rapid-cortex-shared";
import { LanguageSelector } from "@/components/qr-nfc/safety-reporting/LanguageSelector";
import {
  ReportLanguageProvider,
  useReportLanguage,
} from "@/components/intake/report-language";
import {
  categoryToHelpType,
  intakePageBackgroundStyle,
  themeForVertical,
  type VerticalTheme,
} from "@/components/intake/vertical-theme";

type HelpType = "safety" | "medical" | "suspicious" | "other";

/** Optional event metadata — only shown when the resolver returns it. */
type LocationExtras = QRLocationPublic & {
  agencyName?: string;
  securityPhone?: string;
  venueName?: string;
  currentEvent?: { eventName?: string } | null;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadQrIntakeMedia(rcli: string, file: File): Promise<string | null> {
  const isVideo = file.type.startsWith("video/");
  const mediaType = isVideo ? "video" : "image";
  const presignRes = await fetch(
    `/api/r/${encodeURIComponent(rcli)}/media-upload-url?type=${mediaType}`,
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

function formatLocationLine(location: QRLocationPublic): string {
  const parts = [
    location.locationName,
    location.building,
    location.floor ? `Floor ${location.floor}` : null,
    location.zoneCode ? `Zone ${location.zoneCode}` : null,
  ].filter(Boolean);
  return [...new Set(parts)].join(" · ");
}

function agencyDisplayName(
  location: LocationExtras,
  fallbackLabel: string,
): string {
  return location.agencyName?.trim() || location.building?.trim() || fallbackLabel;
}

export function QRIntakeClient(props: { rcli: string; location: QRLocationPublic }) {
  return (
    <ReportLanguageProvider>
      <QRIntakeClientInner {...props} />
    </ReportLanguageProvider>
  );
}

function QRIntakeClientInner({
  rcli,
  location,
}: {
  rcli: string;
  location: QRLocationPublic;
}) {
  const { t, dir, code: langCode } = useReportLanguage();
  const loc = location as LocationExtras;
  const isVenue = location.vertical === "venue";
  const theme = themeForVertical(location.vertical);
  const defaultLocation = formatLocationLine(location);
  const agencyFallback = t(isVenue ? "venueAgencyLabel" : "campusAgencyLabel");

  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [locationOverride, setLocationOverride] = useState(defaultLocation);
  const [anonymous, setAnonymous] = useState(false);
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState("");
  const [descError, setDescError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const eventData = loc.currentEvent ?? null;
  const securityPhone = loc.securityPhone?.trim() || null;
  // Venue defaults: photo on, video off. Campus/core: both on unless explicitly disabled.
  const allowPhoto = location.photoUploadsEnabled !== false;
  const allowVideo =
    location.vertical === "venue"
      ? location.videoUploadsEnabled === true
      : location.videoUploadsEnabled !== false;
  const mediaEnabled = allowPhoto || allowVideo;
  const mediaAccept = [
    allowPhoto ? "image/*" : null,
    allowVideo ? "video/*" : null,
  ]
    .filter(Boolean)
    .join(",");

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setShareLiveLocation(true);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const handlePhoto = async (file: File | null) => {
    if (!file) {
      setPhotoPreview(null);
      setPhotoFile(null);
      return;
    }
    const isVideo = file.type.startsWith("video/");
    if (isVideo && !allowVideo) {
      setError("Video uploads are disabled for this location.");
      return;
    }
    if (!isVideo && !allowPhoto) {
      setError("Photo uploads are disabled for this location.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setPhotoPreview(dataUrl);
    setPhotoFile(file);
  };

  function resetForm() {
    setDescription("");
    setSelectedCategory(null);
    setLocationOverride(defaultLocation);
    setAnonymous(false);
    setReporterName("");
    setReporterPhone("");
    setSubmitted(false);
    setReportId("");
    setDescError(false);
    setError(null);
    setCoords(null);
    setShareLiveLocation(false);
    setPhotoPreview(null);
    setPhotoFile(null);
  }

  async function handleSubmit() {
    if (!description.trim()) {
      setDescError(true);
      descRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);
    setDescError(false);

    try {
      const helpType: HelpType = categoryToHelpType(selectedCategory);
      const mediaKeys: string[] = [];
      if (photoFile) {
        const key = await uploadQrIntakeMedia(rcli, photoFile);
        if (key) mediaKeys.push(key);
      }

      // Category is UI-only: prepend into description; helpType stays on the existing enum.
      const descParts = [
        selectedCategory ? `[${selectedCategory}]` : null,
        locationOverride.trim() && locationOverride.trim() !== defaultLocation
          ? `(Location note: ${locationOverride.trim()})`
          : null,
        description.trim(),
      ].filter(Boolean);

      const res = await fetch(`/api/r/${encodeURIComponent(rcli)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          helpType,
          description: descParts.join(" "),
          mediaKeys,
          shareLiveLocation,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          isAnonymous: anonymous,
          reporterName: anonymous ? null : reporterName.trim() || null,
          reporterPhone: anonymous ? null : reporterPhone.trim() || null,
          preferredLanguage: langCode.toLowerCase(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        referenceId?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? body.message ?? "Unable to submit report. Please try again.");
        return;
      }
      setReportId(body.referenceId ?? `RPT-${Date.now().toString(36).toUpperCase()}`);
      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const pageBackground = intakePageBackgroundStyle(location.vertical);

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      dir={dir}
      lang={langCode.toLowerCase()}
      style={{
        ...(pageBackground ?? { background: theme.pageBg }),
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <PageHeader theme={theme} isVenue={isVenue} />
      <AccentStripes />

      {isVenue && eventData?.eventName ? (
        <EventBanner
          venueName={loc.venueName ?? agencyDisplayName(loc, agencyFallback)}
          eventName={eventData.eventName}
          locationName={defaultLocation}
          liveLabel={t("live")}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-3 pb-6">
        <InfoCard
          theme={theme}
          isVenue={isVenue}
          agencyName={agencyDisplayName(loc, agencyFallback)}
          locationLine={defaultLocation}
        />

        <CallCard theme={theme} isVenue={isVenue} securityPhone={securityPhone} />

        <OrDivider isVenue={isVenue} />

        <div
          className="rounded-2xl border p-4"
          style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
        >
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={18} style={{ color: "#64748b" }} aria-hidden />
            <span className="text-[14px] font-medium" style={{ color: theme.bodyText }}>
              {t("submitAReport")}
            </span>
          </div>

          {submitted ? (
            <SuccessState
              theme={theme}
              isVenue={isVenue}
              reportId={reportId}
              onReset={resetForm}
            />
          ) : (
            <ReportForm
              theme={theme}
              isVenue={isVenue}
              description={description}
              setDescription={setDescription}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              locationOverride={locationOverride}
              setLocationOverride={setLocationOverride}
              anonymous={anonymous}
              setAnonymous={setAnonymous}
              reporterName={reporterName}
              setReporterName={setReporterName}
              reporterPhone={reporterPhone}
              setReporterPhone={setReporterPhone}
              submitting={submitting}
              descError={descError}
              setDescError={setDescError}
              error={error}
              descRef={descRef}
              photoInputRef={photoInputRef}
              photoPreview={photoPreview}
              shareLiveLocation={shareLiveLocation}
              mediaEnabled={mediaEnabled}
              mediaAccept={mediaAccept || "image/*"}
              mediaLabel={t("addPhotoVideo")}
              onPickPhoto={() => photoInputRef.current?.click()}
              onPhotoChange={(file) => void handlePhoto(file)}
              onShareLocation={requestLocation}
              onSubmit={() => void handleSubmit()}
            />
          )}
        </div>
      </div>

      <PageFooter theme={theme} isVenue={isVenue} />
    </div>
  );
}

function PageHeader({ theme, isVenue }: { theme: VerticalTheme; isVenue: boolean }) {
  const { t } = useReportLanguage();
  return (
    <header
      className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      style={{
        background: theme.headerBg,
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-700">
          <Image
            src="/Logo/nowordslogo.png"
            alt="Rapid Cortex"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-100">
            {t(isVenue ? "venueHeader" : "campusHeader")}
          </div>
          <div
            className="flex items-center gap-1 text-[11px]"
            style={{ color: theme.headerSubtext }}
          >
            <Lock size={11} aria-hidden />
            {t("secureReporting")}
          </div>
        </div>
      </div>
      <LanguageSelector variant="dark" />
    </header>
  );
}

function AccentStripes() {
  return (
    <>
      <div style={{ height: 2.5, background: "#dc2626" }} aria-hidden />
      <div style={{ height: 1.5, background: "#2563eb" }} aria-hidden />
    </>
  );
}

function EventBanner({
  venueName,
  eventName,
  locationName,
  liveLabel,
}: {
  venueName: string;
  eventName: string;
  locationName: string;
  liveLabel: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ background: "#1e293b", borderBottom: "0.5px solid #334155" }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: "rgba(245,158,11,0.1)",
          border: "0.5px solid rgba(245,158,11,0.25)",
        }}
        aria-hidden
      >
        <Building2 size={18} style={{ color: "#f59e0b" }} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] font-medium uppercase tracking-wide"
          style={{ color: "#f59e0b" }}
        >
          {venueName}
        </div>
        <div className="truncate text-[13px] font-medium text-slate-200">{eventName}</div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <MapPin size={11} aria-hidden /> {locationName}
        </div>
      </div>
      <div
        className="shrink-0 rounded-full px-2 py-0.5"
        style={{
          background: "rgba(245,158,11,0.12)",
          border: "0.5px solid rgba(245,158,11,0.3)",
        }}
      >
        <span className="text-[10px] font-semibold" style={{ color: "#f59e0b" }}>
          {liveLabel}
        </span>
      </div>
    </div>
  );
}

function InfoCard({
  theme,
  isVenue,
  agencyName,
  locationLine,
}: {
  theme: VerticalTheme;
  isVenue: boolean;
  agencyName: string;
  locationLine: string;
}) {
  const { t } = useReportLanguage();
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
    >
      <div className="mb-3 flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: isVenue ? "rgba(245,158,11,0.08)" : "#f1f5f9",
            border: isVenue ? "0.5px solid rgba(245,158,11,0.2)" : "none",
          }}
          aria-hidden
        >
          <Shield size={20} style={{ color: isVenue ? "#f59e0b" : "#1e3a5f" }} />
        </div>
        <div className="min-w-0">
          <p
            className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.06em]"
            style={{ color: theme.labelColor }}
          >
            {t(isVenue ? "venueAgencyLabel" : "campusAgencyLabel")}
          </p>
          <p className="mb-0.5 text-[15px] font-medium" style={{ color: theme.bodyText }}>
            {agencyName}
          </p>
          <p className="flex items-center gap-1 text-[12px]" style={{ color: "#64748b" }}>
            <MapPin size={12} aria-hidden /> {locationLine}
          </p>
        </div>
      </div>

      <div
        className="mb-3"
        style={{ height: 2, width: 28, background: "#dc2626", borderRadius: 1 }}
        aria-hidden
      />

      <h1 className="mb-1.5 text-xl font-medium" style={{ color: theme.bodyText }}>
        {t(isVenue ? "venueTitle" : "campusTitle")}
      </h1>
      <p className="m-0 text-[13px] leading-relaxed" style={{ color: theme.mutedText }}>
        {t(isVenue ? "venueDesc" : "campusDesc")}
      </p>
    </div>
  );
}

function CallCard({
  theme,
  isVenue,
  securityPhone,
}: {
  theme: VerticalTheme;
  isVenue: boolean;
  securityPhone: string | null;
}) {
  const { t } = useReportLanguage();
  const tel = securityPhone ?? "911";
  const showNumber = securityPhone ?? "911";

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
    >
      <a
        href={`tel:${tel}`}
        className="mb-3 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl py-4 no-underline"
        style={{ background: theme.primary }}
        aria-label={`${securityPhone ? t(isVenue ? "venueCall" : "campusCall") : t("call911")}, ${showNumber}`}
      >
        <Phone size={22} style={{ color: theme.primaryText }} aria-hidden />
        <span className="text-left">
          <span className="block text-[15px] font-medium" style={{ color: theme.primaryText }}>
            {securityPhone ? t(isVenue ? "venueCall" : "campusCall") : t("call911")}
          </span>
          <span
            className="block text-[13px]"
            style={{
              color: isVenue ? "rgba(0,0,0,0.58)" : "rgba(255,255,255,0.82)",
            }}
          >
            {showNumber}
          </span>
        </span>
      </a>
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: theme.emergencyText }}>
        <AlertTriangle size={14} aria-hidden />
        {t("lifeThreat")}
      </div>
    </div>
  );
}

function OrDivider({ isVenue }: { isVenue: boolean }) {
  const { t } = useReportLanguage();
  const line = isVenue ? "#334155" : "#cbd5e1";
  return (
    <div className="flex items-center gap-2" role="separator" aria-label={t("orSubmit")}>
      <div className="flex-1" style={{ height: 0.5, background: line }} />
      <span
        className="whitespace-nowrap text-[11px] font-medium uppercase tracking-widest"
        style={{ color: isVenue ? "#475569" : "#94a3b8" }}
      >
        {t("orSubmit")}
      </span>
      <div className="flex-1" style={{ height: 0.5, background: line }} />
    </div>
  );
}

function ReportForm({
  theme,
  isVenue,
  description,
  setDescription,
  selectedCategory,
  setSelectedCategory,
  locationOverride,
  setLocationOverride,
  anonymous,
  setAnonymous,
  reporterName,
  setReporterName,
  reporterPhone,
  setReporterPhone,
  submitting,
  descError,
  setDescError,
  error,
  descRef,
  photoInputRef,
  photoPreview,
  shareLiveLocation,
  mediaEnabled,
  mediaAccept,
  mediaLabel,
  onPickPhoto,
  onPhotoChange,
  onShareLocation,
  onSubmit,
}: {
  theme: VerticalTheme;
  isVenue: boolean;
  description: string;
  setDescription: (v: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (v: string | null) => void;
  locationOverride: string;
  setLocationOverride: (v: string) => void;
  anonymous: boolean;
  setAnonymous: (v: boolean) => void;
  reporterName: string;
  setReporterName: (v: string) => void;
  reporterPhone: string;
  setReporterPhone: (v: string) => void;
  submitting: boolean;
  descError: boolean;
  setDescError: (v: boolean) => void;
  error: string | null;
  descRef: React.RefObject<HTMLTextAreaElement | null>;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  photoPreview: string | null;
  shareLiveLocation: boolean;
  mediaEnabled: boolean;
  mediaAccept: string;
  mediaLabel: string;
  onPickPhoto: () => void;
  onPhotoChange: (file: File | null) => void;
  onShareLocation: () => void;
  onSubmit: () => void;
}) {
  const { t } = useReportLanguage();
  const isPill = theme.categoryStyle === "pill";
  const catPrefix = isVenue ? "cat.venue" : "cat.campus";

  return (
    <div>
      <p className="mb-2 text-[13px] font-medium" style={{ color: theme.labelText }}>
        {t(isVenue ? "incidentType" : "category")}{" "}
        <span className="font-normal" style={{ color: isVenue ? "#475569" : "#94a3b8" }}>
          {t("optional")}
        </span>
      </p>

      <div className="mb-4 grid grid-cols-2 gap-1.5">
        {theme.categories.map((cat, index) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(isSelected ? null : cat)}
              className={`px-3 text-center text-[12px] transition-all ${
                isPill ? "rounded-full py-2" : "rounded-xl py-3"
              }`}
              style={{
                border: `0.5px solid ${
                  isSelected ? theme.pillBorder : isVenue ? "#334155" : "#e2e8f0"
                }`,
                background: isSelected
                  ? theme.pillSelected
                  : isVenue
                    ? "#111827"
                    : "white",
                color: isSelected ? theme.pillText : isVenue ? "#cbd5e1" : "#374151",
                fontWeight: isSelected ? 500 : 400,
              }}
              aria-pressed={isSelected}
            >
              {t(`${catPrefix}.${index}`)}
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <label
          className="mb-1.5 block text-[13px] font-medium"
          style={{ color: theme.labelText }}
        >
          {t("whatHappening")}{" "}
          <span style={{ color: isVenue ? "#f87171" : "#dc2626" }}>*</span>
        </label>
        <textarea
          ref={descRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("whatHappeningHint")}
          rows={4}
          maxLength={2000}
          required
          aria-required
          className="w-full resize-none rounded-xl text-[13px] leading-relaxed outline-none transition-colors"
          style={{
            border: `0.5px solid ${descError ? "#dc2626" : theme.inputBorder}`,
            padding: "10px 12px",
            background: theme.inputBg,
            color: theme.inputText,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = theme.primary;
            setDescError(false);
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.inputBorder;
          }}
        />
        {descError ? (
          <p className="mt-1 text-[11px]" style={{ color: "#dc2626" }}>
            {t("whatHappeningError")}
          </p>
        ) : null}
      </div>

      <div className="mb-3">
        <label
          className="mb-1.5 flex items-center gap-1 text-[13px] font-medium"
          style={{ color: theme.labelText }}
        >
          <MapPin size={13} style={{ color: "#64748b" }} aria-hidden />
          {t(isVenue ? "yourLocation" : "locationZone")}
        </label>
        <input
          type="text"
          value={locationOverride}
          onChange={(e) => setLocationOverride(e.target.value)}
          className="w-full rounded-xl text-[13px] outline-none transition-colors"
          style={{
            border: `0.5px solid ${theme.inputBorder}`,
            padding: "10px 12px",
            background: theme.inputBg,
            color: theme.inputText,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = theme.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.inputBorder;
          }}
        />
      </div>

      <div
        role="checkbox"
        aria-checked={anonymous}
        tabIndex={0}
        onClick={() => setAnonymous(!anonymous)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setAnonymous(!anonymous);
          }
        }}
        className="mb-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors"
        style={{
          border: `0.5px solid ${theme.inputBorder}`,
          background: theme.inputBg,
        }}
      >
        <div
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] transition-all"
          style={{
            border: `1.5px solid ${anonymous ? theme.anonChecked : isVenue ? "#475569" : "#cbd5e1"}`,
            background: anonymous ? theme.anonChecked : "transparent",
          }}
          aria-hidden
        >
          {anonymous ? (
            <Check size={13} style={{ color: isVenue ? "#0f172a" : "white" }} />
          ) : null}
        </div>
        <span className="text-[13px]" style={{ color: theme.labelText }}>
          {t("reportAnonymously")}
        </span>
      </div>

      {!anonymous ? (
        <div>
          <label
            className="mb-1.5 flex items-center gap-1 text-[13px] font-medium"
            style={{ color: theme.labelText }}
          >
            <UserRound size={13} style={{ color: "#64748b" }} aria-hidden /> {t("yourName")}
          </label>
          <input
            type="text"
            placeholder={t("optionalPlaceholder")}
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            autoComplete="name"
            className="mb-3 w-full rounded-xl text-[13px] outline-none"
            style={{
              border: `0.5px solid ${theme.inputBorder}`,
              padding: "10px 12px",
              background: theme.inputBg,
              color: theme.inputText,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = theme.primary;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme.inputBorder;
            }}
          />

          <label
            className="mb-1.5 block text-[13px] font-medium"
            style={{ color: theme.labelText }}
          >
            {t("yourPhone")}
          </label>
          <input
            type="tel"
            placeholder={t("optionalPlaceholder")}
            value={reporterPhone}
            onChange={(e) => setReporterPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            className="mb-3 w-full rounded-xl text-[13px] outline-none"
            style={{
              border: `0.5px solid ${theme.inputBorder}`,
              padding: "10px 12px",
              background: theme.inputBg,
              color: theme.inputText,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = theme.primary;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme.inputBorder;
            }}
          />
        </div>
      ) : null}

      <input
        ref={photoInputRef}
        type="file"
        accept={mediaAccept}
        capture="environment"
        className="sr-only"
        onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
      />

      <div className={`mb-3 grid gap-2 ${mediaEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
        {mediaEnabled ? (
          <button
            type="button"
            onClick={onPickPhoto}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] transition-colors"
            style={{
              border: `0.5px solid ${theme.inputBorder}`,
              background: theme.inputBg,
              color: "#64748b",
            }}
          >
            <Camera size={14} aria-hidden /> {mediaLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onShareLocation}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] transition-colors"
          style={{
            border: `0.5px solid ${
              shareLiveLocation ? theme.pillBorder : theme.inputBorder
            }`,
            background: shareLiveLocation ? theme.pillSelected : theme.inputBg,
            color: shareLiveLocation ? theme.pillText : "#64748b",
          }}
        >
          <MapPin size={14} aria-hidden />{" "}
          {shareLiveLocation ? t("locationShared") : t("shareLocation")}
        </button>
      </div>

      {photoPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoPreview}
          alt="Selected media preview"
          className="mb-3 max-h-40 w-full rounded-xl border object-cover"
          style={{ borderColor: theme.inputBorder }}
        />
      ) : null}

      <div
        className="mb-4 flex gap-2 rounded-xl px-3 py-2.5"
        style={{
          background: theme.securityBg,
          border: `0.5px solid ${theme.securityBorder}`,
        }}
      >
        <Lock
          size={15}
          style={{ color: theme.securityIcon, flexShrink: 0, marginTop: 1 }}
          aria-hidden
        />
        <p className="m-0 text-[11px] leading-relaxed" style={{ color: theme.securityText }}>
          {t("securityNotice")}
        </p>
      </div>

      {error ? (
        <p className="mb-3 text-[12px]" style={{ color: theme.emergencyText }} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={submitting}
        onClick={onSubmit}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl py-4 text-[15px] font-medium transition-opacity disabled:opacity-50"
        style={{ background: theme.primary, color: theme.primaryText, border: "none" }}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden /> {t("submitting")}
          </>
        ) : (
          <>
            <Check size={15} aria-hidden /> {t("submitReport")}
          </>
        )}
      </button>
    </div>
  );
}

function SuccessState({
  theme,
  isVenue,
  reportId,
  onReset,
}: {
  theme: VerticalTheme;
  isVenue: boolean;
  reportId: string;
  onReset: () => void;
}) {
  const { t } = useReportLanguage();
  return (
    <div className="px-2 py-8 text-center">
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: isVenue ? "rgba(245,158,11,0.1)" : "#f0fdf4",
          border: `2px solid ${isVenue ? "rgba(245,158,11,0.35)" : "#86efac"}`,
        }}
        aria-hidden
      >
        <Check size={28} style={{ color: theme.primary }} />
      </div>

      <h2 className="mb-2 text-lg font-medium" style={{ color: theme.bodyText }}>
        {t(isVenue ? "venueSuccessTitle" : "campusSuccessTitle")}
      </h2>
      <p className="mb-4 text-[13px] leading-relaxed" style={{ color: theme.mutedText }}>
        {t(isVenue ? "venueSuccessDesc" : "campusSuccessDesc")}
      </p>

      {reportId ? (
        <div
          className="mb-5 inline-block rounded-full px-4 py-1.5 font-mono text-[11px]"
          style={{
            background: isVenue ? "#0f172a" : "#f1f5f9",
            border: `0.5px solid ${isVenue ? "#334155" : "#e2e8f0"}`,
            color: isVenue ? "#475569" : "#64748b",
          }}
        >
          {reportId}
        </div>
      ) : null}

      <br />
      <button
        type="button"
        onClick={onReset}
        className="mt-2 rounded-xl px-5 py-2.5 text-[13px] transition-colors"
        style={{
          border: `0.5px solid ${isVenue ? "#334155" : "#e2e8f0"}`,
          background: "transparent",
          color: theme.labelText,
        }}
      >
        {t("submitAnother")}
      </button>
    </div>
  );
}

function PageFooter({ theme, isVenue }: { theme: VerticalTheme; isVenue: boolean }) {
  const { t } = useReportLanguage();
  return (
    <footer
      className="flex items-center justify-between border-t px-4 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
      style={{ background: theme.footerBg, borderColor: theme.footerBorder }}
    >
      <a
        href="tel:911"
        className="flex items-center gap-1.5 text-[12px] font-medium no-underline"
        style={{ color: theme.emergencyText }}
      >
        <AlertCircle size={13} aria-hidden /> {t("emergencyFooter")}
      </a>
      <span className="text-[11px]" style={{ color: isVenue ? "#475569" : "#94a3b8" }}>
        {t("brandDomain")}
      </span>
    </footer>
  );
}

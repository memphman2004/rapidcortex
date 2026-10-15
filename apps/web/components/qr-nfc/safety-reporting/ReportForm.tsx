"use client";

import { Camera, Check, MapPin, MessageSquare, UserRound, Video, X } from "lucide-react";
import { useRef, useState } from "react";
import type { CampusIncidentTypeConfig } from "rapid-cortex-shared";
import { useReportLanguage } from "@/components/intake/report-language";
import { K12ConcernPicker, type K12FollowUpAnswers } from "./K12ConcernPicker";
import { SAFETY_BRAND } from "./tokens";
import { TrustNote } from "./TrustNote";

export type ReportFormValues = {
  message: string;
  locationNote: string;
  anonymous: boolean;
  reporterName: string;
  reporterPhone: string;
  /** Flat-category label (higher-ed / venue) or K-12 type value. */
  category: string | null;
  /** K-12 dynamic follow-up answers keyed by question id. */
  followUpAnswers?: K12FollowUpAnswers;
};

export type ReportFormMediaFile = {
  file: File;
  previewUrl: string;
  kind: "image" | "video";
};

type ReportFormProps = {
  values: ReportFormValues;
  onChange: (patch: Partial<ReportFormValues>) => void;
  /** English category values stored for API/message prepend. */
  categories: string[];
  /** Optional translated labels aligned by index with `categories`. */
  categoryLabels?: string[];
  /** When set, use grouped K-12 picker instead of flat chips. */
  k12Types?: readonly CampusIncidentTypeConfig[];
  locationFieldLabel: string;
  locationPlaceholder: string;
  submitLabel: string;
  showAnonymousToggle: boolean;
  showIdentity: boolean;
  /** Callback phone without requiring full identity (campus). */
  showCallbackPhone?: boolean;
  /** Opt-in to create a browser live-location session after submit. */
  shareLiveLocation?: boolean;
  onShareLiveLocationChange?: (v: boolean) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  /** When true, show optional media / one-shot geolocation UI. */
  showOptionalActions?: boolean;
  /** Selected media (max 1 for now) — parent uploads on submit. */
  mediaFile?: ReportFormMediaFile | null;
  onMediaFileChange?: (media: ReportFormMediaFile | null) => void;
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border bg-white px-3.5 py-3 text-base outline-none transition focus:ring-2";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

export function ReportForm({
  values,
  onChange,
  categories,
  categoryLabels,
  k12Types,
  locationFieldLabel,
  locationPlaceholder,
  submitLabel,
  showAnonymousToggle,
  showIdentity,
  showCallbackPhone = false,
  shareLiveLocation = false,
  onShareLiveLocationChange,
  submitting,
  error,
  onSubmit,
  showOptionalActions = false,
  mediaFile = null,
  onMediaFileChange,
}: ReportFormProps) {
  const { t } = useReportLanguage();
  const useK12Picker = Boolean(k12Types && k12Types.length > 0);
  const phoneFieldVisible = showIdentity || showCallbackPhone;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function clearMedia() {
    if (mediaFile?.previewUrl) URL.revokeObjectURL(mediaFile.previewUrl);
    onMediaFileChange?.(null);
    setMediaError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onPickFile(file: File | null) {
    if (!file || !onMediaFileChange) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      setMediaError("Please choose a photo or short video.");
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      setMediaError("File must be 25 MB or smaller.");
      return;
    }
    if (mediaFile?.previewUrl) URL.revokeObjectURL(mediaFile.previewUrl);
    setMediaError(null);
    onMediaFileChange({
      file,
      previewUrl: URL.createObjectURL(file),
      kind: isVideo ? "video" : "image",
    });
  }

  function shareDeviceLocation() {
    if (!navigator.geolocation) {
      setMediaError("This device cannot share GPS location.");
      return;
    }
    setLocating(true);
    setMediaError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        const tag = `GPS ${lat}, ${lng}`;
        const current = values.locationNote.trim();
        const next = current.includes("GPS ")
          ? current.replace(/GPS\s+-?\d+\.\d+,\s*-?\d+\.\d+/, tag)
          : current
            ? `${current} · ${tag}`
            : tag;
        onChange({ locationNote: next.slice(0, 200) });
        setLocating(false);
      },
      () => {
        setMediaError("Location permission was denied or unavailable.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  return (
    <section
      className="rounded-2xl border bg-white p-5"
      style={{
        borderColor: SAFETY_BRAND.border,
        boxShadow: SAFETY_BRAND.cardShadow,
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" style={{ color: SAFETY_BRAND.deepBlue }} aria-hidden />
        <h2 className="text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
          {t("submitAReport")}
        </h2>
      </div>

      <form onSubmit={onSubmit} noValidate>
        {useK12Picker && k12Types ? (
          <K12ConcernPicker
            types={k12Types}
            selectedType={values.category}
            followUpAnswers={values.followUpAnswers ?? {}}
            onSelectType={(typeValue) =>
              onChange({ category: typeValue, followUpAnswers: {} })
            }
            onFollowUpChange={(followUpAnswers) => onChange({ followUpAnswers })}
          />
        ) : categories.length > 0 ? (
          <fieldset className="mb-4">
            <legend className="text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
              {t("category")}{" "}
              <span className="font-normal" style={{ color: SAFETY_BRAND.muted }}>
                {t("optional")}
              </span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((category, index) => {
                const selected = values.category === category;
                const label = categoryLabels?.[index] ?? category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() =>
                      onChange({ category: selected ? null : category })
                    }
                    className="min-h-10 rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition"
                    style={{
                      borderColor: selected ? SAFETY_BRAND.deepBlue : SAFETY_BRAND.border,
                      backgroundColor: selected ? `${SAFETY_BRAND.deepBlue}12` : SAFETY_BRAND.white,
                      color: selected ? SAFETY_BRAND.deepBlue : SAFETY_BRAND.textDark,
                    }}
                    aria-pressed={selected}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <label className="block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
          {t("whatHappening")} <span style={{ color: SAFETY_BRAND.rapidRed }}>*</span>
          <textarea
            required
            maxLength={1000}
            value={values.message}
            onChange={(e) => onChange({ message: e.target.value })}
            placeholder={t("whatHappeningHint")}
            rows={4}
            className={fieldClass}
            style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
            aria-required
          />
        </label>

        <label className="mt-4 block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" style={{ color: SAFETY_BRAND.muted }} aria-hidden />
            {locationFieldLabel}
          </span>
          <input
            value={values.locationNote}
            onChange={(e) => onChange({ locationNote: e.target.value })}
            placeholder={locationPlaceholder}
            className={fieldClass}
            style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
          />
        </label>

        {showAnonymousToggle ? (
          <label
            className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5"
            style={{ borderColor: SAFETY_BRAND.border }}
          >
            <input
              type="checkbox"
              checked={values.anonymous}
              onChange={(e) => onChange({ anonymous: e.target.checked })}
              className="h-5 w-5 rounded border-slate-300"
              style={{ accentColor: SAFETY_BRAND.deepBlue }}
            />
            <span className="text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
              {t("reportAnonymously")}
            </span>
          </label>
        ) : null}

        {showIdentity ? (
          <label className="mt-4 block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" style={{ color: SAFETY_BRAND.muted }} aria-hidden />
              {t("yourName")}
            </span>
            <input
              value={values.reporterName}
              onChange={(e) => onChange({ reporterName: e.target.value })}
              placeholder={t("optionalPlaceholder")}
              autoComplete="name"
              className={fieldClass}
              style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
            />
          </label>
        ) : null}

        {phoneFieldVisible ? (
          <label className="mt-4 block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
            {t("yourPhone")}
            {shareLiveLocation || showCallbackPhone ? (
              <span className="ml-1 text-xs font-normal" style={{ color: SAFETY_BRAND.muted }}>
                {shareLiveLocation ? "(required to share location)" : "(callback)"}
              </span>
            ) : null}
            <input
              type="tel"
              value={values.reporterPhone}
              onChange={(e) => onChange({ reporterPhone: e.target.value })}
              placeholder={t("optionalPlaceholder")}
              autoComplete="tel"
              inputMode="tel"
              required={shareLiveLocation}
              className={fieldClass}
              style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
            />
          </label>
        ) : null}

        {onShareLiveLocationChange ? (
          <label className="mt-4 flex items-start gap-3 rounded-xl border px-3 py-3">
            <input
              type="checkbox"
              checked={shareLiveLocation}
              onChange={(e) => onShareLiveLocationChange(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300"
              style={{ accentColor: SAFETY_BRAND.deepBlue }}
            />
            <span className="text-left text-sm" style={{ color: SAFETY_BRAND.textDark }}>
              <span className="font-semibold">Share my location until help arrives</span>
              <span className="mt-0.5 block text-xs" style={{ color: SAFETY_BRAND.muted }}>
                Optional. Your live location is only shared with campus safety and stops when they
                arrive or you cancel. Keep this screen open.
              </span>
            </span>
          </label>
        ) : null}

        {showOptionalActions ? (
          <div className="mt-4 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting || !onMediaFileChange}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50"
                style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
                aria-label={t("addPhotoVideo")}
              >
                {mediaFile?.kind === "video" ? (
                  <Video className="h-4 w-4" aria-hidden />
                ) : (
                  <Camera className="h-4 w-4" aria-hidden />
                )}
                {mediaFile ? "Change photo/video" : t("addPhotoVideo")}
              </button>
              <button
                type="button"
                onClick={shareDeviceLocation}
                disabled={submitting || locating}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50"
                style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
                aria-label={t("shareLocation")}
              >
                <MapPin className="h-4 w-4" aria-hidden />
                {locating ? "Locating…" : t("shareLocation")}
              </button>
            </div>
            {mediaFile ? (
              <div
                className="relative overflow-hidden rounded-xl border"
                style={{ borderColor: SAFETY_BRAND.border }}
              >
                {mediaFile.kind === "video" ? (
                  <video
                    src={mediaFile.previewUrl}
                    controls
                    className="max-h-48 w-full bg-black object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- blob preview, not a remote asset
                  <img
                    src={mediaFile.previewUrl}
                    alt="Selected media preview"
                    className="max-h-48 w-full object-contain"
                  />
                )}
                <button
                  type="button"
                  onClick={clearMedia}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                  aria-label="Remove media"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ) : null}
            {mediaError ? (
              <p className="text-xs" style={{ color: SAFETY_BRAND.rapidRed }} role="alert">
                {mediaError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4">
          <TrustNote />
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border px-3 py-3 text-sm"
            style={{
              borderColor: `${SAFETY_BRAND.rapidRed}55`,
              backgroundColor: `${SAFETY_BRAND.rapidRed}0D`,
              color: SAFETY_BRAND.textDark,
            }}
          >
            <p className="font-semibold" style={{ color: SAFETY_BRAND.rapidRed }}>
              {error}
            </p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !values.message.trim()}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-bold text-white transition disabled:opacity-60"
          style={{ backgroundColor: SAFETY_BRAND.actionGreen }}
          aria-busy={submitting}
        >
          {submitting ? (
            t("submitting")
          ) : (
            <>
              <Check className="h-4 w-4" aria-hidden />
              {submitLabel}
            </>
          )}
        </button>
      </form>
    </section>
  );
}

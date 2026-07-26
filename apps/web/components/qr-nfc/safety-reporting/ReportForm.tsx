"use client";

import { Camera, Check, MapPin, MessageSquare, UserRound } from "lucide-react";
import { useReportLanguage } from "@/components/intake/report-language";
import { SAFETY_BRAND } from "./tokens";
import { TrustNote } from "./TrustNote";

export type ReportFormValues = {
  message: string;
  locationNote: string;
  anonymous: boolean;
  reporterName: string;
  reporterPhone: string;
  category: string | null;
};

type ReportFormProps = {
  values: ReportFormValues;
  onChange: (patch: Partial<ReportFormValues>) => void;
  /** English category values stored for API/message prepend. */
  categories: string[];
  /** Optional translated labels aligned by index with `categories`. */
  categoryLabels?: string[];
  locationFieldLabel: string;
  locationPlaceholder: string;
  submitLabel: string;
  showAnonymousToggle: boolean;
  showIdentity: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  /** When true, show optional media / geolocation UI placeholders (no backend). */
  showOptionalActions?: boolean;
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border bg-white px-3.5 py-3 text-base outline-none transition focus:ring-2";

export function ReportForm({
  values,
  onChange,
  categories,
  categoryLabels,
  locationFieldLabel,
  locationPlaceholder,
  submitLabel,
  showAnonymousToggle,
  showIdentity,
  submitting,
  error,
  onSubmit,
  showOptionalActions = true,
}: ReportFormProps) {
  const { t } = useReportLanguage();

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
        {categories.length > 0 ? (
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
          <>
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
            <label className="mt-4 block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
              {t("yourPhone")}
              <input
                type="tel"
                value={values.reporterPhone}
                onChange={(e) => onChange({ reporterPhone: e.target.value })}
                placeholder={t("optionalPlaceholder")}
                autoComplete="tel"
                inputMode="tel"
                className={fieldClass}
                style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
              />
            </label>
          </>
        ) : null}

        {showOptionalActions ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {/* TODO: Wire photo/video upload to public report mediaKeys when upload API is available. */}
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold opacity-60"
              style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.muted }}
              aria-label={t("addPhotoVideo")}
            >
              <Camera className="h-4 w-4" aria-hidden />
              {t("addPhotoVideo")}
            </button>
            {/* TODO: Wire geolocation share into locationNote when browser permission UX is finalized. */}
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold opacity-60"
              style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.muted }}
              aria-label={t("shareLocation")}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              {t("shareLocation")}
            </button>
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

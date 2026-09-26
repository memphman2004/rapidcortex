import { Shield } from "lucide-react";
import { SAFETY_BRAND } from "./tokens";

type SafetyHeroCardProps = {
  contextLabel: string;
  reportingPointName: string;
  locationDetails?: string;
  headline: string;
  supporting: string;
  /** Smaller card for the scan chooser landing. */
  compact?: boolean;
};

export function SafetyHeroCard({
  contextLabel,
  reportingPointName,
  locationDetails,
  headline,
  supporting,
  compact = false,
}: SafetyHeroCardProps) {
  return (
    <section
      className={compact ? "rounded-2xl border bg-white px-4 py-3" : "rounded-2xl border bg-white p-5"}
      style={{
        borderColor: SAFETY_BRAND.border,
        boxShadow: SAFETY_BRAND.cardShadow,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={
            compact
              ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              : "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          }
          style={{ backgroundColor: `${SAFETY_BRAND.deepBlue}14` }}
          aria-hidden
        >
          <Shield
            className={compact ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"}
            style={{ color: SAFETY_BRAND.deepBlue }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: SAFETY_BRAND.deepBlue }}
          >
            {contextLabel}
          </p>
          <p
            className={compact ? "mt-0.5 text-sm font-semibold" : "mt-1.5 text-sm font-semibold"}
            style={{ color: SAFETY_BRAND.textDark }}
          >
            {reportingPointName}
          </p>
          {locationDetails ? (
            <p className="mt-0.5 text-sm" style={{ color: SAFETY_BRAND.muted }}>
              {locationDetails}
            </p>
          ) : null}
        </div>
      </div>
      <div
        className={compact ? "mt-2.5 h-0.5 w-8 rounded-full" : "mt-4 h-0.5 w-10 rounded-full"}
        style={{ backgroundColor: SAFETY_BRAND.rapidRed }}
        aria-hidden
      />
      <h1
        className={
          compact
            ? "mt-2 text-lg font-bold leading-snug tracking-tight"
            : "mt-3 text-[1.35rem] font-bold leading-snug tracking-tight"
        }
        style={{ color: SAFETY_BRAND.textDark }}
      >
        {headline}
      </h1>
      <p
        className={compact ? "mt-1 text-xs leading-snug" : "mt-2 text-sm leading-relaxed"}
        style={{ color: SAFETY_BRAND.muted }}
      >
        {supporting}
      </p>
    </section>
  );
}

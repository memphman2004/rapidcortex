import { Shield } from "lucide-react";
import { SAFETY_BRAND } from "./tokens";

type SafetyHeroCardProps = {
  contextLabel: string;
  agencyName: string;
  zoneName?: string;
  headline: string;
  supporting: string;
};

export function SafetyHeroCard({
  contextLabel,
  agencyName,
  zoneName,
  headline,
  supporting,
}: SafetyHeroCardProps) {
  return (
    <section
      className="rounded-2xl border bg-white p-5"
      style={{
        borderColor: SAFETY_BRAND.border,
        boxShadow: SAFETY_BRAND.cardShadow,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${SAFETY_BRAND.deepBlue}14` }}
          aria-hidden
        >
          <Shield className="h-[18px] w-[18px]" style={{ color: SAFETY_BRAND.deepBlue }} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: SAFETY_BRAND.deepBlue }}
          >
            {contextLabel}
          </p>
          <p className="mt-1.5 text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
            {agencyName}
          </p>
          {zoneName ? (
            <p className="mt-0.5 text-sm" style={{ color: SAFETY_BRAND.muted }}>
              {zoneName}
            </p>
          ) : null}
        </div>
      </div>
      <div
        className="mt-4 h-0.5 w-10 rounded-full"
        style={{ backgroundColor: SAFETY_BRAND.rapidRed }}
        aria-hidden
      />
      <h1 className="mt-3 text-[1.35rem] font-bold leading-snug tracking-tight" style={{ color: SAFETY_BRAND.textDark }}>
        {headline}
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: SAFETY_BRAND.muted }}>
        {supporting}
      </p>
    </section>
  );
}

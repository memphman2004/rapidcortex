"use client";

import type { ReactNode } from "react";
import { Languages } from "lucide-react";
import { useTranslateAssistanceYtd } from "./use-translate-assistance-ytd";

type TranslateAssistanceStatProps = {
  agencyId: string;
  enabled: boolean;
  textColor: string;
  iconBg: string;
  accentColor: string;
};

/**
 * Compact Language assistance (YTD) metric for campus/venue security home KPIs.
 */
export function TranslateAssistanceStat({
  agencyId,
  enabled,
  textColor,
  iconBg,
  accentColor,
}: TranslateAssistanceStatProps) {
  const { count, loading } = useTranslateAssistanceYtd(agencyId, enabled);
  if (!enabled) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Languages size={17} color={accentColor} strokeWidth={1.7} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.04em",
            color: textColor,
            opacity: 0.7,
            fontWeight: 600,
          }}
        >
          LANGUAGE ASSISTANCE (YTD)
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: textColor, lineHeight: 1.2 }}>
          {loading ? "…" : count ?? "—"}
        </div>
      </div>
    </div>
  );
}

export function translateAssistanceKpiCard(opts: {
  agencyId: string;
  enabled: boolean;
  loading: boolean;
  count: number | null;
  textColor: string;
  iconBg: string;
  accentColor: string;
  href?: string;
}): {
  label: string;
  value: string | number;
  color: string;
  icon: ReactNode;
  iconBg: string;
  linkLabel: string;
  href?: string;
} | null {
  if (!opts.enabled) return null;
  return {
    label: "LANGUAGE ASSISTANCE (YTD)",
    value: opts.loading ? "…" : (opts.count ?? "—"),
    color: opts.textColor,
    icon: <Languages size={17} color={opts.accentColor} strokeWidth={1.7} />,
    iconBg: opts.iconBg,
    linkLabel: "View translate sessions",
    href: opts.href,
  };
}

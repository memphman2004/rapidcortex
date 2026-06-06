export type TranscriptConnectorMode = "off" | "shadow" | "on";

export type TranscriptConnectorResolution = {
  mode: TranscriptConnectorMode;
  /** Empty allowlist means all agencies are eligible. */
  agencyEligible: boolean;
  /** True when an external transcript connector is permitted for this agency. */
  connectorActive: boolean;
  /** UI + mock adapters always stay on — external feed is additive until explicitly required. */
  fallback: "side_by_side";
};

export function resolveTranscriptConnectorRollout(
  mode: string | undefined,
  agencyId: string,
  allowlistCsv: string | undefined,
): TranscriptConnectorResolution {
  const m: TranscriptConnectorMode =
    mode === "shadow" || mode === "on" ? mode : "off";
  const allow = new Set(
    (allowlistCsv ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const agencyEligible = allow.size === 0 || allow.has(agencyId);
  const connectorActive = agencyEligible && (m === "on" || m === "shadow");
  return { mode: m, agencyEligible, connectorActive, fallback: "side_by_side" };
}

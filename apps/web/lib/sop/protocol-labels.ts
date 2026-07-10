/** Human-readable labels for SOP protocol pack keys (machine ids stored in DynamoDB). */
export const SOP_PROTOCOL_LABELS: Record<string, string> = {
  "default.cpr_cardiac_v1": "CPR / Cardiac Arrest",
  "default.aed_v1": "AED Required",
  "default.choking_v1": "Choking",
  "default.bleeding_v1": "Severe Bleeding",
  "default.stroke_v1": "Stroke",
  "default.unconscious_v1": "Unconscious Person",
  "default.fire_evac_v1": "Fire / Evacuation",
  "default.domestic_silent_v1": "Domestic — Silent",
  "default.shots_fired_v1": "Shots Fired",
  "default.welfare_check_v1": "Welfare Check",
  "default.unknown_stress_v1": "Unknown / Stress",
};

/**
 * Returns a human-readable label for a protocol pack key.
 * Falls back to a cleaned-up version of the key if not found in the map.
 */
export function sopProtocolLabel(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";

  if (SOP_PROTOCOL_LABELS[trimmed]) return SOP_PROTOCOL_LABELS[trimmed];

  return trimmed
    .replace(/^[^.]+\./, "")
    .replace(/_v\d+$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Display text for the SOP-aware protocol header — uses API label when human,
 * otherwise resolves from pack id or raw key.
 */
export function sopProtocolDisplayLabel(
  incidentTypeLabel: string | null | undefined,
  protocolPackId: string | null | undefined,
): string {
  const label = incidentTypeLabel?.trim() ?? "";

  if (label.startsWith("default.")) {
    return sopProtocolLabel(label);
  }

  if (label && label !== "Unknown") {
    return label;
  }

  if (protocolPackId) {
    return sopProtocolLabel(protocolPackId);
  }

  return label || "Unknown";
}

/**
 * Deterministic address normalize for Context Cards / Vault lookups (v1).
 * ALS geocode is optional and handled at the Lambda layer when available.
 */
export function normalizeAddress(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bAPARTMENT\b/g, "APT")
    .replace(/\bSUITE\b/g, "STE")
    .trim();
}

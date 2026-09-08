import type { CampusBuildingSummary } from "./dashboard-schemas.js";

/**
 * Seed catalog from `seed-campus-test-agency.ts` (Miller / Myers / Tate).
 * Live campus buildings come from Field QR/NFC codes, not this catalog.
 */
export const CAMPUS_DEMO_FIXTURE_BUILDING_CODES = ["MLC", "MYERS", "TATE"] as const;

export function isCampusDemoFixtureBuildingCode(code: string): boolean {
  return (CAMPUS_DEMO_FIXTURE_BUILDING_CODES as readonly string[]).includes(code.trim().toUpperCase());
}

/** Stable BUILDING# sort key from a QR name or explicit buildingId. */
export function campusBuildingCodeFromLabel(label: string): string {
  const stripped = label
    .trim()
    .replace(/\s+reporting\s+qr\s*$/i, "")
    .replace(/\s+qr\s*$/i, "");
  const code = stripped
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return code || "CAMPUS";
}

export type CampusQrCodeForBuilding = {
  qrId: string;
  name: string;
  buildingId?: string;
  zoneName?: string;
  siteCode?: string;
};

/** Buildings tab rows from the same named report codes as the QR Codes / Field list. */
export function campusBuildingSummariesFromQrCodes(
  codes: CampusQrCodeForBuilding[],
): CampusBuildingSummary[] {
  return codes.map((code) => {
    const name = code.name.trim();
    const buildingId = code.buildingId?.trim() || campusBuildingCodeFromLabel(name);
    return {
      buildingId,
      buildingName: name,
      zone: code.zoneName?.trim() || "Unzoned",
      occupancy: null,
      status: "nominal",
      activeIncidents: 0,
      ...(code.siteCode?.trim() ? { siteCode: code.siteCode.trim().toUpperCase() } : {}),
    };
  });
}

export function overlayCampusBuildingIncidents(
  fromQr: CampusBuildingSummary[],
  fromApi: CampusBuildingSummary[],
): CampusBuildingSummary[] {
  const byId = new Map(fromApi.map((row) => [row.buildingId.toUpperCase(), row]));
  const byName = new Map(fromApi.map((row) => [row.buildingName.trim().toLowerCase(), row]));
  return fromQr.map((row) => {
    const match = byId.get(row.buildingId.toUpperCase()) ?? byName.get(row.buildingName.trim().toLowerCase());
    if (!match) return row;
    return {
      ...row,
      occupancy: match.occupancy,
      status: match.status,
      activeIncidents: match.activeIncidents,
      siteCode: row.siteCode ?? match.siteCode,
    };
  });
}

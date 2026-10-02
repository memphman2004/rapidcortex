import type { QRNFCRecord } from "rapid-cortex-shared";
import { campusCodeFromAgencyId } from "../handlers/vertical/agency-id.js";
import type { CampusBuilding } from "./campus-types.js";
import { CAMPUS_KEYS } from "./campus-types.js";
import {
  deleteCampusConfigItem,
  isCampusConfigTableConfigured,
  putCampusConfigItem,
  queryCampusConfigBySkPrefix,
} from "./campus-config-service.js";

const DEMO_FIXTURE_BUILDING_CODES = ["MLC", "MYERS", "TATE"] as const;

function buildingCodeFromLabel(label: string): string {
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

export type CampusQrBuildingInput = Pick<
  QRNFCRecord,
  "agencyId" | "qrId" | "name" | "url" | "vertical"
> & {
  buildingId?: string;
  zoneName?: string;
  floor?: string;
  siteCode?: string;
};

export function inferCampusBuildingType(label: string): CampusBuilding["type"] {
  const n = label.toLowerCase();
  if (/\bhall\b/.test(n) || /residential|dorm/.test(n)) return "residential";
  if (/dining|food|commons/.test(n)) return "dining";
  if (/library|academic|classroom/.test(n)) return "academic";
  if (/stadium|athletic|gym|arena/.test(n)) return "athletic";
  if (/campus|quad|outdoor|parking|plaza/.test(n)) return "outdoor";
  return "administrative";
}

export function parseCampusQrZoneName(zoneName?: string, floorLabel?: string): {
  floor: number;
  roomCode: string;
  label: string;
} {
  const label = zoneName?.trim() || "Unzoned";
  const fromZone = zoneName?.match(/floor\s+(\d+)/i);
  const fromFloor = floorLabel?.match(/(\d+)/);
  const floor = fromZone ? Number(fromZone[1]) : fromFloor ? Number(fromFloor[1]) : 0;
  const buildingPart = zoneName?.match(/building\s+([^,]+)/i)?.[1]?.trim();
  const roomCode = (buildingPart || zoneName || "MAIN").trim().replace(/\s+/g, "-").slice(0, 40);
  return { floor, roomCode: roomCode || "MAIN", label };
}

function zoneCodeFor(buildingCode: string, zone: { floor: number; roomCode: string }): string {
  const floorPart = zone.floor > 0 ? String(zone.floor) : "0";
  const room = zone.roomCode.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase();
  return `${buildingCode}-${floorPart}-${room || "MAIN"}`.slice(0, 80);
}

/** Upsert a campus config building (and optional zone) from a Field QR/NFC report code. */
export async function upsertCampusBuildingFromQr(record: CampusQrBuildingInput): Promise<void> {
  if (record.vertical !== "campus") return;
  if (!isCampusConfigTableConfigured()) return;

  const campusCode = campusCodeFromAgencyId(record.agencyId);
  const label = record.name.trim();
  const code = record.buildingId?.trim() || buildingCodeFromLabel(label);
  if (!code) return;

  const now = new Date().toISOString();
  const pk = CAMPUS_KEYS.configPk(campusCode);
  const zone = record.zoneName?.trim() ? parseCampusQrZoneName(record.zoneName, record.floor) : null;
  const floors = Math.max(zone?.floor ?? 0, 1);

  await putCampusConfigItem({
    pk,
    sk: CAMPUS_KEYS.buildingSk(code),
    id: `b-${code.toLowerCase()}`,
    campusCode,
    agencyId: record.agencyId,
    code,
    label,
    type: inferCampusBuildingType(label),
    floors,
    capacity: null,
    cameraIds: [],
    activeIncidents: 0,
    zones: [],
    source: "qr-nfc",
    qrId: record.qrId,
    ...(record.siteCode?.trim() ? { siteCode: record.siteCode.trim().toUpperCase() } : {}),
    createdAt: now,
    updatedAt: now,
  });

  if (!zone || zone.label === "Unzoned") return;

  const zcode = zoneCodeFor(code, zone);
  await putCampusConfigItem({
    pk,
    sk: CAMPUS_KEYS.zoneSk(zcode),
    code: zcode,
    label: zone.label,
    buildingCode: code,
    buildingLabel: label,
    floor: zone.floor,
    roomCode: zone.roomCode,
    cameraIds: [],
    qrUrl: record.url,
    qrId: record.qrId,
    source: "qr-nfc",
    createdAt: now,
    updatedAt: now,
  });
}

/** Remove the seeded UGA catalog so Buildings matches live QR/NFC codes. */
export async function deleteCampusDemoFixtureBuildings(campusCode: string): Promise<string[]> {
  if (!isCampusConfigTableConfigured()) return [];
  const pk = CAMPUS_KEYS.configPk(campusCode);
  const removed: string[] = [];
  for (const code of DEMO_FIXTURE_BUILDING_CODES) {
    const zones = await queryCampusConfigBySkPrefix(pk, `ZONE#${code}-`);
    for (const row of zones) {
      const sk = typeof row.sk === "string" ? row.sk : "";
      if (!sk) continue;
      await deleteCampusConfigItem(pk, sk);
      removed.push(sk);
    }
    await deleteCampusConfigItem(pk, CAMPUS_KEYS.buildingSk(code));
    removed.push(CAMPUS_KEYS.buildingSk(code));
  }
  return removed;
}

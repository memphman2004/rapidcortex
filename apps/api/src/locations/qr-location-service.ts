import {
  createQRLocationSchema,
  generateRCLI,
  parseRCLI,
  qrLocationBulkRowSchema,
  type QRLocation,
  type QRLocationPublic,
  type QRLocationVertical,
  updateQRLocationSchema,
} from "rapid-cortex-shared";
import { QRLocationsRepository } from "../repositories/qrLocationsRepository.js";

const repo = new QRLocationsRepository();

export function toPublicLocation(location: QRLocation): QRLocationPublic {
  return {
    rcli: location.rcli,
    agencyId: location.agencyId,
    vertical: location.vertical,
    locationName: location.locationName,
    building: location.building,
    floor: location.floor,
    zoneCode: location.zoneCode,
    active: location.active,
  };
}

async function nextSequenceForOrg(agencyId: string, orgCode: string): Promise<number> {
  const rows = await repo.listByAgency(agencyId, { limit: 1000 });
  const code = orgCode.toUpperCase();
  let max = 0;
  for (const row of rows) {
    if (row.orgCode.toUpperCase() !== code) continue;
    const parsed = parseRCLI(row.rcli);
    if (parsed) max = Math.max(max, parsed.sequence);
  }
  return max + 1;
}

export async function suggestNextZoneCode(agencyId: string): Promise<string> {
  const rows = await repo.listByAgency(agencyId, { limit: 1000 });
  let max = 100;
  for (const row of rows) {
    const m = /^RC(\d+)$/.exec(row.zoneCode.toUpperCase());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `RC${max + 1}`;
}

export async function createLocation(
  agencyId: string,
  createdBy: string,
  input: unknown,
): Promise<QRLocation> {
  const parsed = createQRLocationSchema.parse(input);
  const sequence = await nextSequenceForOrg(agencyId, parsed.orgCode);
  const rcli = generateRCLI(parsed.orgCode, sequence);
  const now = new Date().toISOString();
  const location: QRLocation = {
    rcli,
    agencyId,
    orgCode: parsed.orgCode,
    vertical: parsed.vertical,
    locationName: parsed.locationName,
    building: parsed.building,
    floor: parsed.floor,
    zone: parsed.zone,
    zoneCode: parsed.zoneCode,
    lat: parsed.lat,
    lng: parsed.lng,
    active: parsed.active ?? true,
    scanCount: 0,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await repo.put(location);
  return location;
}

export async function updateLocation(
  agencyId: string,
  rcli: string,
  input: unknown,
): Promise<QRLocation | null> {
  const existing = await repo.getByRcli(rcli);
  if (!existing || existing.agencyId !== agencyId) return null;
  const patch = updateQRLocationSchema.parse(input);
  return repo.update(rcli, patch);
}

export async function deactivateLocation(agencyId: string, rcli: string): Promise<boolean> {
  const existing = await repo.getByRcli(rcli);
  if (!existing || existing.agencyId !== agencyId) return false;
  await repo.update(rcli, { active: false });
  return true;
}

export async function listLocations(
  agencyId: string,
  opts?: { vertical?: QRLocationVertical; active?: boolean },
): Promise<QRLocation[]> {
  return repo.listByAgency(agencyId, opts);
}

export async function resolvePublicLocation(rcli: string): Promise<QRLocationPublic | null> {
  const row = await repo.getByRcli(rcli.trim().toUpperCase());
  if (!row || !row.active) return null;
  await repo.recordScan(rcli.trim().toUpperCase());
  return toPublicLocation(row);
}

export async function bulkCreateLocations(
  agencyId: string,
  createdBy: string,
  vertical: QRLocationVertical,
  orgCode: string,
  rows: unknown[],
): Promise<{ created: number; errors: Array<{ row: number; error: string }> }> {
  const errors: Array<{ row: number; error: string }> = [];
  const parsedRows: Array<ReturnType<typeof qrLocationBulkRowSchema.parse>> = [];
  rows.forEach((row, index) => {
    const parsed = qrLocationBulkRowSchema.safeParse(row);
    if (!parsed.success) {
      errors.push({ row: index + 1, error: parsed.error.issues[0]?.message ?? "Invalid row" });
      return;
    }
    parsedRows.push(parsed.data);
  });
  if (errors.length > 0 || parsedRows.length > 1000) {
    if (parsedRows.length > 1000) {
      errors.push({ row: 0, error: "Bulk import limited to 1,000 rows" });
    }
    return { created: 0, errors };
  }
  let created = 0;
  for (const row of parsedRows) {
    await createLocation(agencyId, createdBy, { ...row, vertical, orgCode });
    created += 1;
  }
  return { created, errors };
}

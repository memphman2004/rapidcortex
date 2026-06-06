import type { QRLocation, QRLocationVertical } from "rapid-cortex-shared";
import { isApiConfigured } from "@/lib/api";

export type CreateLocationInput = {
  locationName: string;
  building: string;
  floor?: string;
  zone?: string;
  zoneCode: string;
  orgCode: string;
  vertical: QRLocationVertical;
  lat?: number;
  lng?: number;
  active?: boolean;
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function fetchLocations(
  agencyId: string,
  opts?: { vertical?: QRLocationVertical; active?: boolean },
): Promise<QRLocation[]> {
  if (!isApiConfigured()) throw new Error("API not configured");
  const params = new URLSearchParams();
  if (opts?.vertical) params.set("vertical", opts.vertical);
  if (opts?.active !== undefined) params.set("active", opts.active ? "true" : "false");
  const qs = params.toString();
  const res = await fetch(
    `/api/admin/tenants/${encodeURIComponent(agencyId)}/locations${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
  const data = await parseJson<{ locations: QRLocation[] }>(res);
  return data.locations ?? [];
}

export async function createLocation(agencyId: string, input: CreateLocationInput): Promise<QRLocation> {
  const res = await fetch(`/api/admin/tenants/${encodeURIComponent(agencyId)}/locations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<QRLocation>(res);
}

export async function deactivateLocation(agencyId: string, rcli: string): Promise<void> {
  const res = await fetch(
    `/api/admin/tenants/${encodeURIComponent(agencyId)}/locations/${encodeURIComponent(rcli)}`,
    { method: "DELETE" },
  );
  await parseJson(res);
}

export async function bulkImportLocations(
  agencyId: string,
  payload: { vertical: QRLocationVertical; orgCode: string; rows: unknown[] },
): Promise<{ created: number; errors: Array<{ row: number; error: string }> }> {
  const res = await fetch(`/api/admin/tenants/${encodeURIComponent(agencyId)}/locations/bulk`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export function qrAssetUrl(agencyId: string, rcli: string, format: "png" | "svg" | "pdf", size = 400): string {
  const params = new URLSearchParams({ format, size: String(size) });
  return `/api/admin/tenants/${encodeURIComponent(agencyId)}/locations/${encodeURIComponent(rcli)}/qr?${params}`;
}

export function parseCsvRows(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

export function csvRowsToBulkPayload(rows: Array<Record<string, string>>) {
  return rows.map((row) => ({
    locationName: row.locationname || row["location name"] || row.location || "",
    building: row.building || "",
    floor: row.floor || "",
    zone: row.zone || row.area || "",
    zoneCode: (row.zonecode || row["zone code"] || "").toUpperCase(),
    lat: row.lat ? Number(row.lat) : undefined,
    lng: row.lng ? Number(row.lng) : undefined,
  }));
}

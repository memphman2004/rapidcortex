import type {
  HospitalCapacity,
  HospitalPortalContext,
  ManualCapacityUpdateBody,
} from "rapid-cortex-shared";

export async function fetchHospitalPortalContext(): Promise<HospitalPortalContext> {
  const res = await fetch("/api/hospital-portal/context", { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<HospitalPortalContext>;
}

export async function manualUpdateHospitalCapacity(
  body: ManualCapacityUpdateBody,
): Promise<HospitalCapacity> {
  const res = await fetch("/api/hospital-portal/capacity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<HospitalCapacity>;
}

export async function fetchHospitalCapacityHistory(limit = 10): Promise<HospitalCapacity[]> {
  const res = await fetch(`/api/hospital-portal/capacity/history?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: HospitalCapacity[] };
  return data.items;
}

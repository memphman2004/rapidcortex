import type { HospitalPreAlert, HospitalProfile } from "rapid-cortex-shared";

export async function fetchHospitalPreAlerts(incidentId?: string): Promise<HospitalPreAlert[]> {
  const qs = incidentId ? `?incidentId=${encodeURIComponent(incidentId)}` : "";
  const res = await fetch(`/api/hospitals/prealerts${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: HospitalPreAlert[] };
  return data.items;
}

export async function sendHospitalPreAlert(alertId: string): Promise<void> {
  const res = await fetch(`/api/hospitals/prealerts/${alertId}/send`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}

export async function cancelHospitalPreAlert(alertId: string): Promise<void> {
  const res = await fetch(`/api/hospitals/prealerts/${alertId}/cancel`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchHospitals(): Promise<HospitalProfile[]> {
  const res = await fetch("/api/hospitals", { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: HospitalProfile[] };
  return data.items;
}

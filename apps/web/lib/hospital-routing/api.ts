import type {
  HospitalCapacity,
  HospitalDailyMetrics,
  HospitalPatientNeeds,
  HospitalPerformanceScore,
  HospitalRecommendation,
  MciDistributionPlan,
  MciIncident,
} from "rapid-cortex-shared";

export async function fetchHospitalCapacity(): Promise<HospitalCapacity[]> {
  const res = await fetch("/api/hospitals/capacity", { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: HospitalCapacity[] };
  return data.items;
}

export async function fetchHospitalRecommendations(input: {
  latitude: number;
  longitude: number;
  patientNeeds?: HospitalPatientNeeds;
}): Promise<HospitalRecommendation[]> {
  const res = await fetch("/api/hospitals/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: HospitalRecommendation[] };
  return data.items;
}

export async function createMciDistributionPlan(incident: MciIncident): Promise<MciDistributionPlan> {
  const res = await fetch("/api/hospitals/mci/distribution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(incident),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<MciDistributionPlan>;
}

export async function activateMciPlan(incidentId: string): Promise<MciDistributionPlan> {
  const res = await fetch(`/api/hospitals/mci/${encodeURIComponent(incidentId)}/activate`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<MciDistributionPlan>;
}

export async function fetchHospitalAnalytics(
  hospitalId: string,
  days = 30,
): Promise<HospitalDailyMetrics[]> {
  const res = await fetch(
    `/api/hospitals/${encodeURIComponent(hospitalId)}/analytics?days=${days}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { items: HospitalDailyMetrics[] };
  return data.items;
}

export async function fetchHospitalPerformance(
  hospitalId: string,
  days = 30,
): Promise<HospitalPerformanceScore> {
  const res = await fetch(
    `/api/hospitals/${encodeURIComponent(hospitalId)}/analytics/performance?days=${days}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<HospitalPerformanceScore>;
}

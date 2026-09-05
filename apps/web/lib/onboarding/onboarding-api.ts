import type {
  CampusIntake,
  CampusIntakeRecord,
  CampusIntegrationQuestionnaire,
  CampusIntegrationQuestionnaireRecord,
  OnboardingChecklistPatch,
  OnboardingChecklistState,
  VenueIntake,
  VenueIntakeRecord,
} from "rapid-cortex-shared";

type Query = { orgCode: string; agencyId?: string };

function querySuffix(agencyId?: string): string {
  if (!agencyId?.trim()) return "";
  return `?agencyId=${encodeURIComponent(agencyId.trim())}`;
}

export async function fetchCampusIntake(query: Query): Promise<CampusIntakeRecord | null> {
  const res = await fetch(
    `/api/onboarding/campus/${encodeURIComponent(query.orgCode)}/intake${querySuffix(query.agencyId)}`,
    { credentials: "include" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load campus intake (${res.status})`);
  const data = (await res.json()) as { intake: CampusIntakeRecord | null };
  return data.intake ?? null;
}

export async function saveCampusIntake(
  query: Query,
  body: CampusIntake,
): Promise<CampusIntakeRecord> {
  const res = await fetch(
    `/api/onboarding/campus/${encodeURIComponent(query.orgCode)}/intake${querySuffix(query.agencyId)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Save failed (${res.status})`);
  }
  const data = (await res.json()) as { intake: CampusIntakeRecord };
  return data.intake;
}

export async function fetchCampusIntegrations(
  query: Query,
): Promise<CampusIntegrationQuestionnaireRecord | null> {
  const res = await fetch(
    `/api/onboarding/campus/${encodeURIComponent(query.orgCode)}/integrations${querySuffix(query.agencyId)}`,
    { credentials: "include" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load integration questionnaire (${res.status})`);
  const data = (await res.json()) as { questionnaire: CampusIntegrationQuestionnaireRecord | null };
  return data.questionnaire ?? null;
}

export async function saveCampusIntegrations(
  query: Query,
  body: CampusIntegrationQuestionnaire,
): Promise<CampusIntegrationQuestionnaireRecord> {
  const res = await fetch(
    `/api/onboarding/campus/${encodeURIComponent(query.orgCode)}/integrations${querySuffix(query.agencyId)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Save failed (${res.status})`);
  }
  const data = (await res.json()) as { questionnaire: CampusIntegrationQuestionnaireRecord };
  return data.questionnaire;
}

export async function fetchCampusChecklist(query: Query): Promise<OnboardingChecklistState | null> {
  const res = await fetch(
    `/api/onboarding/campus/${encodeURIComponent(query.orgCode)}/checklist${querySuffix(query.agencyId)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`Failed to load checklist (${res.status})`);
  const data = (await res.json()) as { checklist: OnboardingChecklistState | null };
  return data.checklist ?? null;
}

export async function patchCampusChecklist(
  query: Query,
  patch: OnboardingChecklistPatch,
): Promise<OnboardingChecklistState> {
  const res = await fetch(
    `/api/onboarding/campus/${encodeURIComponent(query.orgCode)}/checklist${querySuffix(query.agencyId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Update failed (${res.status})`);
  }
  const data = (await res.json()) as { checklist: OnboardingChecklistState };
  return data.checklist;
}

export async function fetchVenueIntake(query: Query): Promise<VenueIntakeRecord | null> {
  const res = await fetch(
    `/api/onboarding/venue/${encodeURIComponent(query.orgCode)}/intake${querySuffix(query.agencyId)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`Failed to load venue intake (${res.status})`);
  const data = (await res.json()) as { intake: VenueIntakeRecord | null };
  return data.intake ?? null;
}

export async function saveVenueIntake(query: Query, body: VenueIntake): Promise<VenueIntakeRecord> {
  const res = await fetch(
    `/api/onboarding/venue/${encodeURIComponent(query.orgCode)}/intake${querySuffix(query.agencyId)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Save failed (${res.status})`);
  }
  const data = (await res.json()) as { intake: VenueIntakeRecord };
  return data.intake;
}

export async function fetchVenueChecklist(query: Query): Promise<OnboardingChecklistState | null> {
  const res = await fetch(
    `/api/onboarding/venue/${encodeURIComponent(query.orgCode)}/checklist${querySuffix(query.agencyId)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`Failed to load checklist (${res.status})`);
  const data = (await res.json()) as { checklist: OnboardingChecklistState | null };
  return data.checklist ?? null;
}

export async function patchVenueChecklist(
  query: Query,
  patch: OnboardingChecklistPatch,
): Promise<OnboardingChecklistState> {
  const res = await fetch(
    `/api/onboarding/venue/${encodeURIComponent(query.orgCode)}/checklist${querySuffix(query.agencyId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Update failed (${res.status})`);
  }
  const data = (await res.json()) as { checklist: OnboardingChecklistState };
  return data.checklist;
}

export type OnboardingPacketFile = {
  fileName: string;
  title: string;
  key: string;
  source: "s3" | "bundled";
  contentType: string;
  sizeBytes?: number;
  updatedAt?: string;
};

export type OnboardingPacketFolder = {
  vertical: "campus" | "venue" | "hospital" | "transit" | "psap";
  title: string;
  summary: string;
  files: OnboardingPacketFile[];
};

export async function fetchOnboardingPackets(): Promise<{
  folders: OnboardingPacketFolder[];
  storage: "s3" | "bundled";
}> {
  const res = await fetch("/api/admin/onboarding-packets", { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Failed to load packets (${res.status})`);
  }
  return res.json() as Promise<{ folders: OnboardingPacketFolder[]; storage: "s3" | "bundled" }>;
}

export async function downloadOnboardingPacket(body: {
  vertical: OnboardingPacketFolder["vertical"];
  key: string;
}): Promise<{
  fileName: string;
  contentType: string;
  downloadUrl?: string;
  markdown?: string;
}> {
  const res = await fetch("/api/admin/onboarding-packets/download", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Download failed (${res.status})`);
  }
  return res.json() as Promise<{
    fileName: string;
    contentType: string;
    downloadUrl?: string;
    markdown?: string;
  }>;
}


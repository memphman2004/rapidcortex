import type {
  AgencyNetworkPolicy,
  PatchAgencyNetworkPolicyBody,
} from "rapid-cortex-shared";
import type { AuditEvent } from "rapid-cortex-shared/types";

type PolicyResponse = {
  policy: AgencyNetworkPolicy;
  wafSyncStatus: AgencyNetworkPolicy["wafSyncStatus"];
};

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { data?: T; error?: string };
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `Request failed (${res.status})`);
  }
  if (!json.data) throw new Error("Empty response");
  return json.data;
}

export async function fetchAgencyNetworkPolicy(agencyId: string): Promise<PolicyResponse> {
  const res = await fetch(
    `/api/backend/api/admin/agencies/${encodeURIComponent(agencyId)}/network-policy`,
    { credentials: "include", cache: "no-store" },
  );
  return parseJson<PolicyResponse>(res);
}

export async function patchAgencyNetworkPolicy(
  agencyId: string,
  body: PatchAgencyNetworkPolicyBody,
): Promise<AgencyNetworkPolicy> {
  const res = await fetch(
    `/api/backend/api/admin/agencies/${encodeURIComponent(agencyId)}/network-policy`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await parseJson<{ policy: AgencyNetworkPolicy }>(res);
  return data.policy;
}

export async function addAgencyNetworkCidr(
  agencyId: string,
  body: { cidr: string; label: string },
): Promise<AgencyNetworkPolicy> {
  const res = await fetch(
    `/api/backend/api/admin/agencies/${encodeURIComponent(agencyId)}/network-policy/cidrs`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const data = await parseJson<{ policy: AgencyNetworkPolicy }>(res);
  return data.policy;
}

export async function removeAgencyNetworkCidr(
  agencyId: string,
  cidr: string,
): Promise<AgencyNetworkPolicy> {
  const params = new URLSearchParams({ cidr });
  const res = await fetch(
    `/api/backend/api/admin/agencies/${encodeURIComponent(agencyId)}/network-policy/cidrs?${params}`,
    { method: "DELETE", credentials: "include" },
  );
  const data = await parseJson<{ policy: AgencyNetworkPolicy }>(res);
  return data.policy;
}

export async function fetchAgencyNetworkPolicyAudit(agencyId: string): Promise<AuditEvent[]> {
  const res = await fetch(
    `/api/backend/api/admin/agencies/${encodeURIComponent(agencyId)}/network-policy/audit`,
    { credentials: "include", cache: "no-store" },
  );
  const data = await parseJson<{ items: AuditEvent[] }>(res);
  return data.items;
}

export async function triggerAgencyNetworkPolicyResync(agencyId: string): Promise<AgencyNetworkPolicy> {
  const current = await fetchAgencyNetworkPolicy(agencyId);
  return patchAgencyNetworkPolicy(agencyId, {
    ipAllowlistEnabled: current.policy.ipAllowlistEnabled,
  });
}

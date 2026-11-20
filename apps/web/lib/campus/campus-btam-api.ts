/**
 * BTAM API client — Behavioral Threat Assessment & Management (K-12 only).
 * All calls are authenticated via the BFF session cookie.
 * agencyId is always resolved from the server session, never from client state.
 */

import type { BtamCaseRecord, BtamOpenCaseBody, BtamPatchCaseBody } from "rapid-cortex-shared";

export interface BtamListResult {
  cases: BtamCaseRecord[];
  cursor?: string;
  total: number;
}

export async function fetchBtamCases(
  agencyId: string,
  opts?: { campusCode?: string; status?: string; limit?: number; cursor?: string },
): Promise<BtamListResult> {
  const params = new URLSearchParams();
  if (opts?.campusCode) params.set("campusCode", opts.campusCode);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/btam${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load BTAM cases (${res.status})`);
  return res.json() as Promise<BtamListResult>;
}

export async function fetchBtamCase(
  agencyId: string,
  caseId: string,
): Promise<BtamCaseRecord> {
  const res = await fetch(
    `/api/campus/${encodeURIComponent(agencyId)}/btam/${encodeURIComponent(caseId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load BTAM case (${res.status})`);
  const data = (await res.json()) as { case: BtamCaseRecord };
  return data.case;
}

export async function openBtamCase(
  agencyId: string,
  body: BtamOpenCaseBody,
): Promise<BtamCaseRecord> {
  const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/btam`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to open case (${res.status})`);
  }
  const data = (await res.json()) as { case: BtamCaseRecord };
  return data.case;
}

export async function patchBtamCase(
  agencyId: string,
  caseId: string,
  body: BtamPatchCaseBody,
): Promise<BtamCaseRecord> {
  const res = await fetch(
    `/api/campus/${encodeURIComponent(agencyId)}/btam/${encodeURIComponent(caseId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to update case (${res.status})`);
  }
  const data = (await res.json()) as { case: BtamCaseRecord };
  return data.case;
}

export async function addBtamAction(
  agencyId: string,
  caseId: string,
  body: { type: BtamCaseRecord["actions"][0]["type"]; description: string; safetyPlanSummary?: string },
): Promise<BtamCaseRecord> {
  const res = await fetch(
    `/api/campus/${encodeURIComponent(agencyId)}/btam/${encodeURIComponent(caseId)}/actions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to add action (${res.status})`);
  }
  const data = (await res.json()) as { case: BtamCaseRecord };
  return data.case;
}

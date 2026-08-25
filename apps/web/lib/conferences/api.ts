import type { Conference, CreateConferenceBody, PatchConferenceBody } from "rapid-cortex-shared";

const BASE = "/api/rc-admin/conferences";
export const CONFERENCES_QUERY_KEY = ["rc-admin", "conferences"] as const;

type Envelope = {
  items?: Conference[];
  item?: Conference;
  error?: string;
};

async function parseJson(res: Response): Promise<Envelope> {
  const body = (await res.json().catch(() => ({}))) as Envelope;
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export async function listConferences(): Promise<Conference[]> {
  const res = await fetch(BASE, { cache: "no-store" });
  const body = await parseJson(res);
  return Array.isArray(body.items) ? body.items : [];
}

export async function createConference(payload: CreateConferenceBody): Promise<Conference> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!body.item) throw new Error("Conference was not created");
  return body.item;
}

export async function patchConference(
  conferenceId: string,
  payload: PatchConferenceBody,
): Promise<Conference> {
  const res = await fetch(`${BASE}/${encodeURIComponent(conferenceId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!body.item) throw new Error("Conference was not updated");
  return body.item;
}

import type {
  AddPsapActivityRequest,
  PatchPsapProspectBody,
  PsapMapPin,
  PsapProspect,
  PsapProspectContact,
  PsapProspectListQuery,
  PsapProspectListResponse,
  PsapProspectStats,
} from "rapid-cortex-shared";

const BASE = "/api/rc-admin/psap-prospects";

type ApiEnvelope<T> = {
  prospect?: T;
  pins?: PsapMapPin[];
  contacts?: PsapProspectContact[];
  count?: number;
  error?: string;
} & Partial<T>;

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T> & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

function unwrapProspect(body: ApiEnvelope<PsapProspect>): PsapProspect {
  const prospect = body.prospect;
  if (!prospect) throw new Error("Missing prospect in response");
  return prospect;
}

function toSearchParams(query: PsapProspectListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.state) params.set("state", query.state);
  if (query.outreachStatus) params.set("outreachStatus", query.outreachStatus);
  if (query.assignedToUserId) params.set("assignedToUserId", query.assignedToUserId);
  if (query.search) params.set("search", query.search);
  if (query.hasAddress !== undefined) params.set("hasAddress", String(query.hasAddress));
  if (query.hasContact !== undefined) params.set("hasContact", String(query.hasContact));
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  if (query.verifiedOnly !== undefined) params.set("verifiedOnly", String(query.verifiedOnly));
  return params;
}

export async function listPsapProspects(
  query: PsapProspectListQuery = {},
): Promise<PsapProspectListResponse> {
  const qs = toSearchParams(query).toString();
  const res = await fetch(`${BASE}${qs ? `?${qs}` : ""}`, { credentials: "include" });
  return parseJson<PsapProspectListResponse>(res);
}

export async function getPsapProspect(psapId: string): Promise<PsapProspect> {
  const res = await fetch(`${BASE}/${encodeURIComponent(psapId)}`, { credentials: "include" });
  const body = await parseJson<ApiEnvelope<PsapProspect>>(res);
  return unwrapProspect(body);
}

export async function patchPsapProspect(
  psapId: string,
  patch: PatchPsapProspectBody,
): Promise<PsapProspect> {
  const res = await fetch(`${BASE}/${encodeURIComponent(psapId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await parseJson<ApiEnvelope<PsapProspect>>(res);
  return unwrapProspect(body);
}

export async function addPsapActivity(
  psapId: string,
  activity: AddPsapActivityRequest,
): Promise<PsapProspect> {
  const res = await fetch(`${BASE}/${encodeURIComponent(psapId)}/activities`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(activity),
  });
  const body = await parseJson<ApiEnvelope<PsapProspect>>(res);
  return unwrapProspect(body);
}

export async function enrichPsapContacts(psapId: string): Promise<{
  prospect: PsapProspect;
  contacts: PsapProspectContact[];
  count: number;
  hunterCount?: number;
  apolloCount?: number;
  domains?: string[];
  changed?: boolean;
  changeLog?: {
    changed: boolean;
    reason: string;
    fieldsChanged: string[];
    domains: string[];
  };
}> {
  const res = await fetch(`${BASE}/${encodeURIComponent(psapId)}/enrich-contacts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await parseJson<
    ApiEnvelope<PsapProspect> & {
      contacts?: PsapProspectContact[];
      count?: number;
      hunterCount?: number;
      apolloCount?: number;
      domains?: string[];
      changed?: boolean;
      changeLog?: {
        changed: boolean;
        reason: string;
        fieldsChanged: string[];
        domains: string[];
      };
    }
  >(res);
  return {
    prospect: unwrapProspect(body),
    contacts: body.contacts ?? [],
    count: body.count ?? body.contacts?.length ?? 0,
    hunterCount: body.hunterCount,
    apolloCount: body.apolloCount,
    domains: body.domains,
    changed: body.changed,
    changeLog: body.changeLog,
  };
}

export async function enrichAllPsapContacts(limit = 10): Promise<{
  count: number;
  contactsFound: number;
  message: string;
}> {
  const res = await fetch(`${BASE}/enrich-all`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  return parseJson<{ count: number; contactsFound: number; message: string }>(res);
}

export async function getPsapStats(): Promise<PsapProspectStats> {
  const res = await fetch(`${BASE}/stats`, { credentials: "include" });
  return parseJson<PsapProspectStats>(res);
}

export async function getPsapMapPins(): Promise<PsapMapPin[]> {
  const res = await fetch(`${BASE}/map-pins`, { credentials: "include" });
  const body = await parseJson<{ pins?: PsapMapPin[] }>(res);
  return body.pins ?? [];
}

/** URL for CSV export download (use as `<a href>` or `window.location`). */
export function buildPsapExportUrl(query: PsapProspectListQuery = {}): string {
  const qs = toSearchParams(query).toString();
  return `${BASE}/export${qs ? `?${qs}` : ""}`;
}

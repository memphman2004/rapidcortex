import type {
  ContactCompany,
  ContactPerson,
  ContactVertical,
  CreateCompanyBody,
  CreateContactBody,
  RelationshipType,
  UpdateContactBody,
} from "rapid-cortex-shared";

export type {
  ContactCompany,
  ContactPerson,
  ContactVertical,
  CreateCompanyBody,
  CreateContactBody,
  RelationshipType,
  UpdateContactBody,
};

const BASE = "/api/contacts";

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export async function listCompanies(params?: {
  q?: string;
  relationshipType?: RelationshipType | "all";
  vertical?: ContactVertical | "all";
}): Promise<ContactCompany[]> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.relationshipType && params.relationshipType !== "all") {
    sp.set("relationshipType", params.relationshipType);
  }
  if (params?.vertical && params.vertical !== "all") sp.set("vertical", params.vertical);
  const qs = sp.toString();
  const data = await json<{ items: ContactCompany[] }>(
    await fetch(`${BASE}/companies${qs ? `?${qs}` : ""}`, { credentials: "include" }),
  );
  return data.items ?? [];
}

export async function createCompany(body: CreateCompanyBody): Promise<ContactCompany> {
  const data = await json<{ item: ContactCompany }>(
    await fetch(`${BASE}/companies`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return data.item;
}

export async function listCompanyContacts(companyId: string): Promise<ContactPerson[]> {
  const data = await json<{ items: ContactPerson[] }>(
    await fetch(`${BASE}/companies/${encodeURIComponent(companyId)}/contacts`, {
      credentials: "include",
    }),
  );
  return data.items ?? [];
}

export async function createContact(
  companyId: string,
  body: CreateContactBody,
): Promise<ContactPerson> {
  const data = await json<{ item: ContactPerson }>(
    await fetch(`${BASE}/companies/${encodeURIComponent(companyId)}/contacts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return data.item;
}

export async function updateContact(
  contactId: string,
  body: UpdateContactBody,
): Promise<ContactPerson> {
  const data = await json<{ item: ContactPerson }>(
    await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return data.item;
}

export const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  prospect: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  partner: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  competitor: "bg-red-500/15 text-red-300 border-red-500/30",
  vendor: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  influencer: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  customer: "bg-green-500/15 text-green-300 border-green-500/30",
};

export const RELATIONSHIP_BORDER: Record<RelationshipType, string> = {
  prospect: "border-l-sky-500",
  partner: "border-l-emerald-500",
  competitor: "border-l-red-500",
  vendor: "border-l-violet-500",
  influencer: "border-l-amber-500",
  customer: "border-l-green-500",
};

export function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

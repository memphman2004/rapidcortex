import type { HubSpotLeadInput } from "rapid-cortex-shared";
import { hubSpotObjectsForLead } from "rapid-cortex-shared";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type HubSpotPushResult = {
  contactId: string;
  dealId: string;
};

function hubSpotError(status: number, body: string): Error {
  return new Error(`HubSpot ${status}: ${body.slice(0, 180)}`);
}

async function readId(res: Response): Promise<string> {
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error("HubSpot response did not include an id");
  return body.id;
}

async function findContactId(email: string, token: string, fetchImpl: FetchLike): Promise<string | null> {
  const res = await fetchImpl("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
      ],
      limit: 1,
    }),
  });
  if (!res.ok) throw hubSpotError(res.status, await res.text());
  const body = (await res.json()) as { results?: Array<{ id: string }> };
  return body.results?.[0]?.id ?? null;
}

/**
 * Creates a HubSpot contact and an associated deal.
 * A contact that already exists for this email is reused.
 */
export async function createHubSpotContactAndDeal(
  token: string,
  lead: HubSpotLeadInput,
  fetchImpl: FetchLike = fetch,
): Promise<HubSpotPushResult> {
  const { contact, deal } = hubSpotObjectsForLead(lead);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const created = await fetchImpl("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify({ properties: contact }),
  });

  let contactId: string;
  if (created.status === 409) {
    const existing = await findContactId(lead.email, token, fetchImpl);
    if (!existing) throw new Error("HubSpot contact already exists but could not be found by email");
    contactId = existing;
  } else if (!created.ok) {
    throw hubSpotError(created.status, await created.text());
  } else {
    contactId = await readId(created);
  }

  const dealRes = await fetchImpl("https://api.hubapi.com/crm/v3/objects/deals", {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: deal,
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
        },
      ],
    }),
  });
  if (!dealRes.ok) throw hubSpotError(dealRes.status, await dealRes.text());
  return { contactId, dealId: await readId(dealRes) };
}

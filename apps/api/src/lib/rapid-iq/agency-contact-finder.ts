import { randomUUID } from "node:crypto";
import type { RapidIqContact, RapidIqVertical } from "rapid-cortex-shared";
import { isCollectorsMockEnabled } from "./agenda-finder.js";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import { ALL_JURISDICTIONS } from "./jurisdiction-registry.js";

type ExtractedContact = {
  name: string | null;
  title: string;
  roleTier: RapidIqContact["roleTier"];
  email: string | null;
  phone: string | null;
};

export type FindAgencyContactsInput = {
  agencyName: string;
  agencyType: string;
  city: string;
  state: string;
  vertical: RapidIqVertical;
  jurisdictionId?: string;
  priorityUrls?: string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveAnthropicKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "ANTHROPIC_API_KEY" },
  );
}

function parseJsonLoose<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
  } catch {
    return fallback;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
}

export function buildContactSearchTargets(
  agencyName: string,
  city: string,
  state: string,
  vertical: RapidIqVertical,
  priorityUrls: string[] = [],
): { url: string; label: string }[] {
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const stateSlug = state.toLowerCase();
  const countyMatch = agencyName.match(/^(\w+)\s+county/i);
  const countySlug = countyMatch ? countyMatch[1]!.toLowerCase() : citySlug;

  const priority = priorityUrls
    .filter(Boolean)
    .map((url) => ({ url, label: `${agencyName} directory` }));

  let guessed: { url: string; label: string }[] = [];
  if (vertical === "911") {
    guessed = [
      { url: `https://www.${countySlug}911.com/about`, label: `${agencyName} official website` },
      {
        url: `https://www.${countySlug}county.gov/911`,
        label: `${agencyName} county 911 page`,
      },
      {
        url: `https://www.${countySlug}co.gov/departments/emergency-communications`,
        label: `${agencyName} emergency communications`,
      },
      {
        url: `https://www.${countySlug}county.gov/government/staff`,
        label: `${agencyName} county staff directory`,
      },
      {
        url: `https://www.${countySlug}county.gov/government/directory`,
        label: `${agencyName} county directory`,
      },
      {
        url: `https://www.${citySlug}ga.gov/departments/public-safety`,
        label: `${city} public safety`,
      },
      {
        url: `https://www.${citySlug}${stateSlug}.gov/911`,
        label: `${city} 911`,
      },
    ];
  } else if (vertical === "campus") {
    guessed = [
      {
        url: `https://www.${citySlug}.edu/police/about/staff`,
        label: `${agencyName} campus police staff`,
      },
      { url: `https://safety.${citySlug}.edu/about`, label: `${agencyName} campus safety` },
      {
        url: `https://www.${citySlug}.edu/administration`,
        label: `${agencyName} administration directory`,
      },
    ];
  } else {
    guessed = [
      { url: `https://www.${citySlug}.com/about/security`, label: `${agencyName} security` },
      { url: `https://www.${citySlug}.com/contact`, label: `${agencyName} contact` },
    ];
  }

  const seen = new Set<string>();
  const out: { url: string; label: string }[] = [];
  for (const t of [...priority, ...guessed]) {
    if (seen.has(t.url)) continue;
    seen.add(t.url);
    out.push(t);
  }
  return out;
}

export async function extractContacts(
  text: string,
  agencyName: string,
  vertical: RapidIqVertical,
): Promise<ExtractedContact[]> {
  if (isCollectorsMockEnabled() || !(await resolveAnthropicKey())) {
    return [
      {
        name: null,
        title: vertical === "campus" ? "Campus Police Chief" : "911 Communications Director",
        roleTier: "primary",
        email: null,
        phone: null,
      },
      {
        name: null,
        title: vertical === "campus" ? "Director of Public Safety" : "IT / CAD Manager",
        roleTier: "secondary",
        email: null,
        phone: null,
      },
    ];
  }

  const apiKey = await resolveAnthropicKey();
  const model = process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-20250514";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system:
        "Extract public safety decision-maker contacts from directory text. Return ONLY a JSON array of objects with keys name, title, roleTier (primary|secondary|influencer), email, phone. Never invent emails or phones.",
      messages: [
        {
          role: "user",
          content: `Agency: ${agencyName}\nVertical: ${vertical}\nText:\n${text.slice(0, 3000)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const raw = body.content?.find((b) => b.type === "text")?.text ?? "[]";
  const parsed = parseJsonLoose<ExtractedContact[]>(raw, []);
  return Array.isArray(parsed) ? parsed.filter((c) => c?.title) : [];
}

export async function findAgencyContacts(
  input: FindAgencyContactsInput,
): Promise<Omit<RapidIqContact, "opportunityId">[]> {
  const fromRegistry =
    input.jurisdictionId != null
      ? (ALL_JURISDICTIONS.find((j) => j.jurisdictionId === input.jurisdictionId)?.contactUrls ?? [])
      : [];
  const priorityUrls = [...(input.priorityUrls ?? []), ...fromRegistry];
  const targets = buildContactSearchTargets(
    input.agencyName,
    input.city,
    input.state,
    input.vertical,
    priorityUrls,
  );

  if (isCollectorsMockEnabled()) {
    const extracted = await extractContacts(
      `${input.agencyName} public safety directory`,
      input.agencyName,
      input.vertical,
    );
    return extracted.slice(0, 2).map((c) => ({
      contactId: randomUUID(),
      name: c.name,
      title: c.title,
      roleTier: c.roleTier,
      matchType: c.name ? ("exact" as const) : ("related" as const),
      matchedOn: c.title,
      verificationStatus: c.name ? ("verified" as const) : ("predicted" as const),
      verificationSource: targets[0]?.label ?? "directory",
      sourceCount: 1,
      verifiedAt: c.name ? new Date().toISOString() : null,
      sourceUrl: targets[0]?.url ?? null,
      email: c.email,
      emailVerified: Boolean(c.email),
      phone: c.phone,
      linkedInUrl: null,
    }));
  }

  const allContacts: Omit<RapidIqContact, "opportunityId">[] = [];

  for (const target of targets.slice(0, 4)) {
    try {
      await sleep(1_500);
      const res = await fetch(target.url, {
        headers: { "user-agent": "RapidCortex-RapidIQ/1.0 (+https://rapidcortex.us)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const text = stripHtml(await res.text());
      if (text.length < 40) continue;

      const extracted = await extractContacts(text, input.agencyName, input.vertical);
      for (const c of extracted) {
        if (!c.title) continue;
        allContacts.push({
          contactId: randomUUID(),
          name: c.name,
          title: c.title,
          roleTier: c.roleTier ?? "primary",
          matchType: c.name ? "exact" : "related",
          matchedOn: c.title,
          verificationStatus: c.name ? "verified" : "predicted",
          verificationSource: target.label,
          sourceCount: 1,
          verifiedAt: c.name ? new Date().toISOString() : null,
          sourceUrl: target.url,
          email: c.email,
          emailVerified: Boolean(c.email),
          phone: c.phone,
          linkedInUrl: null,
        });
      }
      if (allContacts.length >= 4) break;
    } catch {
      /* skip unreachable directories */
    }
  }

  return allContacts;
}

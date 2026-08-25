/**
 * Extract decision-maker contacts from signal text (Claude when available).
 */

import { randomBytes } from "node:crypto";
import {
  RAPID_IQ_CONTACT_CONFIDENCE,
  type RapidIqAgencyContact,
  type RapidIqPipelineContactHint,
} from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../runtimeSecrets.js";
import { isCollectorsMockEnabled } from "../agenda-finder.js";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

async function resolveAnthropicKey(): Promise<string> {
  return resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "ANTHROPIC_API_KEY" },
  );
}

function parseJsonArray(text: string): Array<Record<string, unknown>> {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
        return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

function newContactId(): string {
  return randomBytes(8).toString("hex");
}

function fromHints(
  hints: RapidIqPipelineContactHint[] | undefined,
  agencyId: string,
  sourceUrl: string,
): RapidIqAgencyContact[] {
  const now = new Date().toISOString();
  return (hints ?? [])
    .filter((h) => h.name.trim())
    .slice(0, 8)
    .map((h) => ({
      contactId: newContactId(),
      agencyId,
      name: h.name.trim(),
      title: h.title,
      role: h.title,
      sourceUrl,
      sourceName: "Document extraction",
      confidence: RAPID_IQ_CONTACT_CONFIDENCE.EXTRACTED_DOC,
      lastVerified: now,
    }));
}

export async function extractContactsFromText(input: {
  text: string;
  agencyName: string;
  agencyId: string;
  sourceUrl: string;
  hints?: RapidIqPipelineContactHint[];
}): Promise<RapidIqAgencyContact[]> {
  const fallback = fromHints(input.hints, input.agencyId, input.sourceUrl);
  if (isCollectorsMockEnabled()) return fallback;

  const apiKey = await resolveAnthropicKey();
  if (!apiKey) return fallback;

  const prompt = `Extract people and their titles from this text.
Only extract people who appear to be decision-makers for technology or
emergency communications purchases: 911 Directors, Emergency Communications
Directors, Sheriffs, Chiefs of Police, Fire Chiefs, CIOs, IT Directors,
Procurement Officers, County Administrators, or similar roles.

Agency: ${input.agencyName}
Text: "${input.text.slice(0, 3000)}"

Return JSON array only:
[{"name": "...", "title": "...", "role": "...", "email": "..." }]
Return empty array [] if no relevant contacts found.
Do not invent contacts. Only extract what is explicitly stated.`;

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL_PRIMARY?.trim() || "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return fallback;
    const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "[]";
    const rows = parseJsonArray(text);
    const now = new Date().toISOString();
    const extracted: RapidIqAgencyContact[] = [];
    for (const row of rows) {
      const name = String(row.name ?? "").trim();
      if (!name) continue;
      const email = String(row.email ?? "").trim();
      extracted.push({
        contactId: newContactId(),
        agencyId: input.agencyId,
        name,
        title: String(row.title ?? "").trim() || undefined,
        role: String(row.role ?? row.title ?? "").trim() || undefined,
        email: email && email.includes("@") ? email : undefined,
        sourceUrl: input.sourceUrl,
        sourceName: "Document extraction",
        confidence: RAPID_IQ_CONTACT_CONFIDENCE.EXTRACTED_DOC,
        lastVerified: now,
      });
    }
    return extracted.length > 0 ? extracted : fallback;
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_extract_contacts_failed",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
    return fallback;
  }
}

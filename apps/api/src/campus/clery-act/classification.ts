import {
  CLERY_CLASSIFICATION_SYSTEM_PROMPT,
  TIMELY_WARNING_HIGH_CATEGORIES,
  cleryOffenseCategorySchema,
  type CleryClassificationSuggestion,
  type CleryGeographySuggestion,
  type CleryOffenseCategory,
  type TimelyWarningAssessment,
} from "rapid-cortex-shared";
import type { CampusIncident } from "../campus-types.js";
import { env } from "../../lib/env.js";
import { cleryActStore } from "./store.js";

const KEYWORD_OFFENSE: Array<{ keywords: string[]; offense: CleryOffenseCategory }> = [
  { keywords: ["rape", "sexual assault", "penetrat"], offense: "RAPE" },
  { keywords: ["fondl", "groped", "unwanted touching"], offense: "FONDLING" },
  { keywords: ["robbery", "robbed", "forced to give"], offense: "ROBBERY" },
  { keywords: ["arson", "set fire", "willful burning"], offense: "ARSON" },
  { keywords: ["burglary", "broke into", "broken window", "unlawful entry"], offense: "BURGLARY" },
  { keywords: ["stolen car", "vehicle theft", "stolen vehicle"], offense: "MOTOR_VEHICLE_THEFT" },
  { keywords: ["aggravated assault", "weapon", "serious injury"], offense: "AGGRAVATED_ASSAULT" },
  { keywords: ["stalk", "following me"], offense: "STALKING" },
  { keywords: ["domestic", "spouse", "intimate partner"], offense: "DOMESTIC_VIOLENCE" },
  { keywords: ["dating violence", "boyfriend hit", "girlfriend hit"], offense: "DATING_VIOLENCE" },
];

function mockSuggest(incident: CampusIncident): CleryClassificationSuggestion {
  const text = `${incident.type} ${incident.description}`.toLowerCase();
  const hits = KEYWORD_OFFENSE.filter((k) => k.keywords.some((w) => text.includes(w)));
  const primary: CleryOffenseCategory =
    hits.length === 1 ? hits[0].offense : "NOT_CLERY_REPORTABLE";
  const confidence = hits.length === 1 ? 0.72 : 0.45;
  return {
    primaryOffense: primary,
    confidence,
    rationale:
      hits.length === 1
        ? `Keyword match against campus incident text suggests ${primary}. This is advisory only.`
        : "Description is ambiguous or does not clearly meet a Clery offense definition. Human review is required.",
    isHateCrimePossible: /\b(bias|racist|slur|hate)\b/i.test(text),
    hateCrimeRationale: "Hate crime requires evidence of bias motivation — do not assume.",
    isVAWAPossible: hits.some((h) =>
      ["STALKING", "DOMESTIC_VIOLENCE", "DATING_VIOLENCE"].includes(h.offense),
    ),
    vawaRationale: "VAWA categories require relationship context between the parties.",
    alternativeCategory: hits.length > 1 ? hits[1]?.offense ?? null : null,
    questionsForCoordinator: [
      "Was the location owned or controlled by the institution or a recognized student organization?",
      "Is there evidence a crime occurred, or only a suspicious circumstance?",
    ],
  };
}

function parseSuggestion(raw: unknown): CleryClassificationSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const offense = cleryOffenseCategorySchema.safeParse(o.primaryOffense);
  if (!offense.success) return null;
  const alt =
    o.alternativeCategory == null
      ? null
      : cleryOffenseCategorySchema.safeParse(o.alternativeCategory).success
        ? String(o.alternativeCategory)
        : null;
  const questions = Array.isArray(o.questionsForCoordinator)
    ? o.questionsForCoordinator.filter((q) => typeof q === "string").slice(0, 8)
    : [];
  const confidence = typeof o.confidence === "number" ? Math.min(1, Math.max(0, o.confidence)) : 0.4;
  return {
    primaryOffense: offense.data,
    confidence,
    rationale: typeof o.rationale === "string" ? o.rationale.slice(0, 2000) : "No rationale provided.",
    isHateCrimePossible: o.isHateCrimePossible === true,
    hateCrimeRationale: typeof o.hateCrimeRationale === "string" ? o.hateCrimeRationale.slice(0, 1000) : "",
    isVAWAPossible: o.isVAWAPossible === true,
    vawaRationale: typeof o.vawaRationale === "string" ? o.vawaRationale.slice(0, 1000) : "",
    alternativeCategory: alt,
    questionsForCoordinator: questions,
  };
}

/**
 * Suggests a Clery category. NEVER writes classification to a CleryRecord.
 */
export async function suggestCleryClassification(
  agencyId: string,
  incident: CampusIncident,
): Promise<CleryClassificationSuggestion> {
  void agencyId;
  if (env.cleryClassificationMock) {
    return mockSuggest(incident);
  }
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return mockSuggest(incident);
    const user = JSON.stringify({
      type: incident.type,
      description: incident.description,
      building: incident.buildingLabel,
      zone: incident.zoneLabel,
      roomOmitted: true,
      reporter: incident.isAnonymous ? "anonymous" : "identified (details omitted)",
    });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: CLERY_CLASSIFICATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return mockSuggest(incident);
    const body = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = (body.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) return mockSuggest(incident);
    const parsed = parseSuggestion(JSON.parse(text.slice(jsonStart, jsonEnd + 1)));
    return parsed ?? mockSuggest(incident);
  } catch {
    return mockSuggest(incident);
  }
}

export async function suggestCleryGeography(
  agencyId: string,
  incident: CampusIncident,
): Promise<CleryGeographySuggestion> {
  const rcli = incident.qrRcli;
  if (!rcli) {
    return {
      geography: null,
      isResidentialFacility: false,
      zoneConfigured: false,
      message: "This incident is not tied to a QR zone. The coordinator must set Clery geography.",
    };
  }
  const zone = await cleryActStore.getZone(agencyId, rcli);
  if (!zone) {
    return {
      geography: null,
      isResidentialFacility: false,
      zoneConfigured: false,
      rcli,
      message: "This zone has no Clery geography configured. Configure it before classifying.",
    };
  }
  return {
    geography: zone.cleryGeography,
    isResidentialFacility: zone.isResidentialFacility,
    zoneConfigured: true,
    buildingName: zone.buildingName,
    rcli,
  };
}

export function assessTimelyWarning(
  suggestedOffense: CleryOffenseCategory,
): TimelyWarningAssessment {
  const high = (TIMELY_WARNING_HIGH_CATEGORIES as readonly string[]).includes(suggestedOffense);
  return {
    recommended: high,
    likelihood: high ? "high" : suggestedOffense === "NOT_CLERY_REPORTABLE" ? "low" : "medium",
    rationale: high
      ? `${suggestedOffense} is a high-priority Clery category that often requires a timely warning if an ongoing threat exists. The coordinator decides.`
      : "Timely warning is required only when a Clery crime poses an ongoing threat to campus. The coordinator decides.",
    requiresCoordinatorDecision: true,
  };
}

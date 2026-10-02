/**
 * DynamoDB clients, table-name helpers, and key builders for the features suite.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SNSClient } from "@aws-sdk/client-sns";
import { SESClient } from "@aws-sdk/client-ses";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { ComprehendClient } from "@aws-sdk/client-comprehend";

const region = process.env.AWS_REGION;

const ddbClient = new DynamoDBClient(region ? { region } : {});
export const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const s3 = new S3Client(region ? { region } : {});
export const sns = new SNSClient(region ? { region } : {});
export const ses = new SESClient(region ? { region } : {});
export const bedrock = new BedrockRuntimeClient(region ? { region } : {});
export const comprehend = new ComprehendClient(region ? { region } : {});

function requireTable(envName: string, fallback?: string): string {
  const value = process.env[envName]?.trim() || fallback?.trim();
  if (!value) {
    throw new Error(`Missing required env ${envName}`);
  }
  return value;
}

function optionalTable(envName: string): string | undefined {
  const value = process.env[envName]?.trim();
  return value || undefined;
}

/** Feature suite is on unless explicitly disabled. */
export function isFeaturesSuiteEnabled(): boolean {
  const raw = process.env.ENABLE_FEATURES_SUITE;
  return raw !== "false" && raw !== "0";
}

export function isBedrockMock(): boolean {
  return process.env.BEDROCK_MOCK === "1" || process.env.BEDROCK_MOCK === "true";
}

export const FeatureTables = {
  citizens: () => requireTable("CITIZENS_TABLE"),
  address: () => requireTable("ADDRESS_INTEL_TABLE"),
  altResponse: () => requireTable("ALT_RESPONSE_TABLE"),
  coResponders: () => requireTable("CO_RESPONDERS_TABLE"),
  mutualAid: () => requireTable("MUTUAL_AID_TABLE"),
  mci: () => requireTable("MCI_TABLE"),
  infra: () => requireTable("INFRA_TABLE"),
  interpreter: () => requireTable("INTERPRETER_TABLE"),
  evidence: () => requireTable("EVIDENCE_TABLE"),
  assessment: () => requireTable("ASSESSMENT_TABLE"),
  learning: () => requireTable("LEARNING_TABLE"),
  events: () => requireTable("PUBLIC_EVENTS_TABLE"),
  checkin: () => requireTable("CHECKIN_TABLE"),
  social: () => requireTable("SOCIAL_SIGNALS_TABLE"),
} as const;

export const FeatureBuckets = {
  preplan: () => optionalTable("PREPLAN_BUCKET"),
  evidence: () => optionalTable("EVIDENCE_BUCKET"),
  preplanCdn: () => optionalTable("PREPLAN_CDN_DOMAIN"),
  evidenceCdn: () => optionalTable("EVIDENCE_CDN_DOMAIN"),
} as const;

export const FeatureTopics = {
  panic: () => optionalTable("PANIC_ALERT_SNS_TOPIC"),
  social: () => optionalTable("SOCIAL_ALERT_SNS_TOPIC"),
} as const;

export const CitizenKeys = {
  profile: (phoneE164: string) => ({ pk: `CITIZEN#${phoneE164}`, sk: "PROFILE" as const }),
  agencyRef: (agencyId: string, profileId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `CITIZEN_REF#${profileId}`,
  }),
};

export const AddressKeys = {
  unit: (agencyId: string, normalizedAddress: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `ADDR#${normalizedAddress}`,
  }),
};

export const AltResponseKeys = {
  flag: (agencyId: string, incidentId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `ALT_RESPONSE#${incidentId}`,
  }),
};

export const CoResponderKeys = {
  unit: (agencyId: string, unitId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `CORESPONDER#${unitId}`,
  }),
  prefix: "CORESPONDER#",
};

export const MutualAidKeys = {
  request: (agencyId: string, requestId: string, createdAt: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `MAID_REQ#${requestId}#${createdAt}`,
  }),
  prefix: "MAID_REQ#",
};

export const MciKeys = {
  event: (agencyId: string, mciId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `MCI#${mciId}`,
  }),
  patient: (mciId: string, patientId: string) => ({
    pk: `MCI#${mciId}`,
    sk: `PATIENT#${patientId}`,
  }),
  patientPrefix: (mciId: string) => ({ pk: `MCI#${mciId}`, prefix: "PATIENT#" }),
};

export const InfraKeys = {
  item: (agencyId: string, infraId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `INFRA#${infraId}`,
  }),
  prefix: "INFRA#",
};

export const InterpreterKeys = {
  request: (agencyId: string, requestId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `INTERP#${requestId}`,
  }),
  prefix: "INTERP#",
  lepPrefix: (year: string, month?: string) =>
    month ? `LEP#${year}#${month.padStart(2, "0")}` : `LEP#${year}`,
};

export const EvidenceKeys = {
  item: (agencyId: string, evidenceId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `EVIDENCE#${evidenceId}`,
  }),
  prefix: "EVIDENCE#",
};

export const AssessmentKeys = {
  session: (agencyId: string, sessionId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `SESSION#${sessionId}`,
  }),
  scenario: (agencyId: string, scenarioId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `SCENARIO#${scenarioId}`,
  }),
  sessionPrefix: "SESSION#",
};

export const LearningKeys = {
  pattern: (agencyId: string, patternType: string, detectedAt: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `PATTERN#${patternType}#${detectedAt}`,
  }),
  patternPrefix: "PATTERN#",
};

export const EventKeys = {
  item: (agencyId: string, eventId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `EVENT#${eventId}`,
  }),
  prefix: "EVENT#",
};

export const CheckinKeys = {
  timer: (agencyId: string, timerId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `TIMER#${timerId}`,
  }),
  panic: (agencyId: string, alertId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `PANIC#${alertId}`,
  }),
  timerPrefix: "TIMER#",
  panicPrefix: "PANIC#",
};

export const SocialKeys = {
  signal: (agencyId: string, signalId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `SIGNAL#${signalId}`,
  }),
  /** Per-agency Bluesky poll cursor / last-seen timestamp. */
  blueskyMeta: (agencyId: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: "META#BLUESKY_POLL" as const,
  }),
  /** Dedup key for an external source URL (prevents re-ingest). */
  sourceDedup: (agencyId: string, source: string, sourceUrlHash: string) => ({
    pk: `AGENCY#${agencyId}`,
    sk: `DEDUP#${source}#${sourceUrlHash}`,
  }),
  prefix: "SIGNAL#",
};

/** Agency partition key used across features tables. */
export function agencyPk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

/**
 * Minimal geohash encoder (precision 1–12). Avoids an ngeohash dependency.
 */
export function encodeGeohash(lat: number, lon: number, precision = 8): string {
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = "";
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        idx = idx * 2 + 1;
        lonMin = mid;
      } else {
        idx = idx * 2;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx = idx * 2;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      geohash += base32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

export function normalizeAddress(street: string, city: string, state: string, zip: string): string {
  return `${street.toLowerCase().trim()},${city.toLowerCase().trim()},${state.toLowerCase().trim()},${zip.trim()}`;
}

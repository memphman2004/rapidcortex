import type { AgencyConfig } from "rapid-cortex-shared";

export type CjiDataType = "incident" | "transcript" | "media" | "analysis";

export type RetentionDefaultEnv = {
  defaultRetentionPolicyId: string;
  retentionIncidentDaysDefault: number;
  retentionTranscriptDaysDefault: number;
  retentionMediaDaysDefault: number;
  retentionAnalysisDaysDefault: number;
};

/** Must match `retGsiPk` in Dynamo and sam template. */
export const RETENTION_GSI_PK = "RETENTION";
export const RETENTION_DUE_GSI = "retention-due-index";

const MS_PER_DAY = 86_400_000;

function addDaysMs(iso: string, days: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) throw new Error("INVALID_ANCHOR_TIME");
  return new Date(t + days * MS_PER_DAY).toISOString();
}

function parsePositiveInt(v: string | undefined, fallback: number): number {
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export function resolveEnvRetentionDefaults(
  e: Pick<
    RetentionDefaultEnv,
    "retentionIncidentDaysDefault" | "retentionTranscriptDaysDefault" | "retentionMediaDaysDefault" | "retentionAnalysisDaysDefault"
  >,
) {
  return {
    incident: e.retentionIncidentDaysDefault,
    transcript: e.retentionTranscriptDaysDefault,
    media: e.retentionMediaDaysDefault,
    analysis: e.retentionAnalysisDaysDefault,
  };
}

export function resolvePolicyId(config: AgencyConfig | undefined, fallbackPolicyId: string): string {
  return config?.retentionPolicyId?.trim() || fallbackPolicyId;
}

export function resolveDaysForType(
  type: CjiDataType,
  config: AgencyConfig | undefined,
  e: Pick<
    RetentionDefaultEnv,
    "retentionIncidentDaysDefault" | "retentionTranscriptDaysDefault" | "retentionMediaDaysDefault" | "retentionAnalysisDaysDefault"
  >,
): number {
  const o = config?.retentionOverrideDays;
  const d = resolveEnvRetentionDefaults(e);
  switch (type) {
    case "incident":
      return o?.incident ?? d.incident;
    case "transcript":
      return o?.transcript ?? d.transcript;
    case "media":
      return o?.media ?? d.media;
    case "analysis":
      return o?.analysis ?? d.analysis;
    default: {
      const _x: never = type;
      return _x;
    }
  }
}

export function buildRetentionGsiSk(expiresAtIso: string, dedupe: string): string {
  if (!dedupe) throw new Error("RET_DEDUPE_EMPTY");
  return `${expiresAtIso}#${dedupe}`;
}

export function retentionQueryUpperBoundSk(now: Date = new Date()): string {
  return `${now.toISOString()}#\uFFFF`;
}

export function buildRetentionFields(
  type: CjiDataType,
  args: {
    agencyConfig: AgencyConfig | undefined;
    anchorIso: string;
    policyId: string;
    dedupe: string;
    envDefaults: RetentionDefaultEnv;
  },
): {
  retentionPolicyId: string;
  retentionExpiresAt: string;
  retGsiPk: string;
  retGsiSk: string;
} {
  const days = resolveDaysForType(type, args.agencyConfig, args.envDefaults);
  const policyKey = resolvePolicyId(args.agencyConfig, args.policyId);
  const exp = addDaysMs(args.anchorIso, days);
  return {
    retentionPolicyId: policyKey,
    retentionExpiresAt: exp,
    retGsiPk: RETENTION_GSI_PK,
    retGsiSk: buildRetentionGsiSk(exp, args.dedupe),
  };
}

export function buildIncidentDedupe(incidentId: string) {
  return `inc#${incidentId}`;
}
export function buildTranscriptDedupe(incidentId: string, timestamp: string) {
  return `tr#${incidentId}#${timestamp}`;
}
export function buildAnalysisDedupe(incidentId: string, createdAt: string) {
  return `an#${incidentId}#${createdAt}`;
}
export function buildMediaDedupe(agencyId: string, mediaId: string) {
  return `md#${agencyId}#${mediaId}`;
}

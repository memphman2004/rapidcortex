import {
  defaultEnsTestProgram,
  ensScopeDescription,
  ensTestKindToTemplateType,
  ensTestProgramSchema,
  ensTestProgramUpsertBodySchema,
  ensManualRunBodySchema,
  ensSiteBoundaryUpsertBodySchema,
  isConfirmDispatchToken,
  type EnsTestKind,
  type EnsTestProgram,
  type EnsTestRun,
  type AlertVertical,
} from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { dispatchOccupantAlert } from "./service.js";
import { alertsStore } from "./store.js";
import { upsertEnsSiteBoundary } from "./ens-boundary.js";
import { getFourwindsClient } from "./fourwinds-config.js";

function nowIso(): string {
  return new Date().toISOString();
}

export async function getOrCreateEnsProgram(
  agencyId: string,
  vertical: AlertVertical,
  displayName: string,
): Promise<EnsTestProgram> {
  if (vertical === "transit") {
    throw Object.assign(new Error("ENS program is campus/venue only"), { statusCode: 400 });
  }
  const existing = await alertsStore.getEnsProgram(agencyId, vertical);
  if (existing) return existing;
  const program = defaultEnsTestProgram(vertical, agencyId, displayName);
  await alertsStore.putEnsProgram(program);
  return program;
}

export async function saveEnsProgram(
  agencyId: string,
  body: unknown,
): Promise<EnsTestProgram> {
  const parsed = ensTestProgramUpsertBodySchema.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(new Error("INVALID_PROGRAM"), { statusCode: 400, zod: parsed.error });
  }
  if (parsed.data.vertical === "transit") {
    throw Object.assign(new Error("ENS program is campus/venue only"), { statusCode: 400 });
  }
  const existing =
    (await alertsStore.getEnsProgram(agencyId, parsed.data.vertical)) ??
    defaultEnsTestProgram(parsed.data.vertical, agencyId, parsed.data.institutionName ?? agencyId);
  const merged = ensTestProgramSchema.parse({
    ...existing,
    ...parsed.data,
    agencyId,
    updatedAt: nowIso(),
  });
  await alertsStore.putEnsProgram(merged);
  return merged;
}

export async function saveEnsBoundary(agencyId: string, body: unknown) {
  const parsed = ensSiteBoundaryUpsertBodySchema.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(new Error("INVALID_BOUNDARY"), { statusCode: 400, zod: parsed.error });
  }
  if (parsed.data.vertical === "transit") {
    throw Object.assign(new Error("ENS boundary is campus/venue only"), { statusCode: 400 });
  }
  return upsertEnsSiteBoundary({
    agencyId,
    vertical: parsed.data.vertical,
    boundaryPolygon: parsed.data.boundaryPolygon,
  });
}

export async function runEnsTest(params: {
  agencyId: string;
  actorId: string;
  displayName: string;
  body: unknown;
  scheduled?: boolean;
  canCritical: boolean;
}): Promise<{ run: EnsTestRun; jobId: string }> {
  const parsed = ensManualRunBodySchema.safeParse(params.body);
  if (!parsed.success) {
    throw Object.assign(new Error("INVALID_RUN"), { statusCode: 400, zod: parsed.error });
  }
  if (!isConfirmDispatchToken(parsed.data.confirmation ?? parsed.data.confirmationToken)) {
    throw Object.assign(new Error("CONFIRM_REQUIRED"), { statusCode: 400 });
  }
  if (parsed.data.vertical === "transit") {
    throw Object.assign(new Error("ENS tests are campus/venue only"), { statusCode: 400 });
  }
  return executeEnsTest({
    agencyId: params.agencyId,
    actorId: params.actorId,
    displayName: params.displayName,
    vertical: parsed.data.vertical,
    kind: parsed.data.kind,
    scheduled: params.scheduled ?? false,
    canCritical: params.canCritical,
  });
}

export async function executeEnsTest(params: {
  agencyId: string;
  actorId: string;
  displayName: string;
  vertical: AlertVertical;
  kind: EnsTestKind;
  scheduled: boolean;
  canCritical: boolean;
}): Promise<{ run: EnsTestRun; jobId: string }> {
  const program = await getOrCreateEnsProgram(params.agencyId, params.vertical, params.displayName);
  const boundary = await alertsStore.getEnsBoundary(params.agencyId, params.vertical);
  const templateType = ensTestKindToTemplateType[params.kind];
  const templates = await alertsStore.listTemplates(params.agencyId);
  const template = templates.find((t) => t.vertical === params.vertical && t.type === templateType);
  if (!template) {
    throw Object.assign(new Error("ENS_TEMPLATE_MISSING"), { statusCode: 503 });
  }
  const groups = await alertsStore.listGroups(params.agencyId);
  const groupIds = groups
    .filter((g) => g.vertical === params.vertical && program.defaultGroupSlugs.includes(g.slug))
    .map((g) => g.groupId);
  if (groupIds.length === 0) {
    throw Object.assign(new Error("ENS_GROUPS_MISSING"), { statusCode: 400 });
  }

  let channels = [...program.defaultChannels];
  if (params.kind === "monthly_silent") {
    channels = channels.filter((c) => c !== "PA_SIREN");
  }

  const runId = makeId("ensrun");
  const scopeDescription = ensScopeDescription({
    program,
    kind: params.kind,
    boundaryConfigured: Boolean(boundary?.boundaryPolygon?.length),
  });

  const job = await dispatchOccupantAlert({
    agencyId: params.agencyId,
    actorId: params.actorId,
    displayName: program.institutionName || params.displayName,
    body: {
      vertical: params.vertical,
      templateId: template.templateId,
      groupIds,
      channels,
      confirmation: "CONFIRM",
      ensTestKind: params.kind,
      fourwindsScopes: program.fourwindsScopes,
      html5FallbackUrl: program.html5FallbackUrl,
    },
    canCritical: params.canCritical,
    isEnsTest: true,
    ensTestRunId: runId,
  });

  const failures: string[] = [];
  const fw = await getFourwindsClient();
  if (channels.includes("DISPLAY_TAKEOVER") && program.fourwindsEnabled && fw) {
    const scopes =
      program.fourwindsScopes.length > 0
        ? program.fourwindsScopes
        : [{ scopeType: "campus" as const, scopeId: params.agencyId, label: program.institutionName }];
    const displayRow = job.channelSummary.find((c) => c.channel === "DISPLAY_TAKEOVER");
    if (displayRow && displayRow.failed > 0) {
      failures.push(`Four Winds activate reported failure (${displayRow.skipReason ?? "unknown"})`);
    }
    const clear = await fw.clearEmergency({
      incidentId: job.jobId,
      title: "All clear",
      body: "ENS test complete — displays may resume normal content.",
      severity: "INFO",
      scopes,
    });
    if (!clear.ok) failures.push(`Four Winds all-clear: ${clear.error ?? "failed"}`);
  }

  const run: EnsTestRun = {
    runId,
    agencyId: params.agencyId,
    vertical: params.vertical,
    kind: params.kind,
    jobId: job.jobId,
    initiatedAt: job.initiatedAt,
    completedAt: job.completedAt,
    scopeDescription,
    channels,
    channelSummary: job.channelSummary,
    failures,
    actorId: params.actorId,
    scheduled: params.scheduled,
  };
  await alertsStore.putEnsRun(run);

  program.lastRunAt = { ...program.lastRunAt, [params.kind]: job.initiatedAt };
  program.updatedAt = nowIso();
  await alertsStore.putEnsProgram(program);

  return { run, jobId: job.jobId };
}

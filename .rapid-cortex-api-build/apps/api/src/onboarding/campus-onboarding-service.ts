import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  campusIntakeSchema,
  campusIntegrationQuestionnaireSchema,
  onboardingChecklistPatchSchema,
  type CampusIntakeRecord,
  type CampusIntegrationQuestionnaireRecord,
  type OnboardingChecklistState,
  type OnboardingVertical,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { CAMPUS_KEYS } from "../campus/campus-types.js";
import { saveCampusSites } from "../campus/campus-sites-service.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { normalizeCampusCode } from "../campus/campus-access.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

const INTAKE_SK = "INTAKE";
const CHECKLIST_SK = "CHECKLIST";
const INTEGRATION_SK = "INTEGRATION_QUESTIONNAIRE";

function campusConfigTable(): string {
  const t = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CONFIG_TABLE not set");
  return t;
}

export async function getCampusIntake(campusCode: string): Promise<CampusIntakeRecord | null> {
  const code = normalizeCampusCode(campusCode);
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(code),
        sk: INTAKE_SK,
      },
    }),
  );
  return (result.Item as CampusIntakeRecord | undefined) ?? null;
}

export async function saveCampusIntake(opts: {
  campusCode: string;
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<CampusIntakeRecord> {
  const code = normalizeCampusCode(opts.campusCode);
  const parsed = campusIntakeSchema.parse(opts.body);
  const now = new Date().toISOString();

  const existing = await getCampusIntake(code);
  if (existing && existing.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  const item: CampusIntakeRecord = {
    ...parsed,
    orgCode: code,
    agencyId: opts.agencyId,
    submittedAt: existing?.submittedAt ?? now,
    submittedBy: existing?.submittedBy ?? opts.actorId,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(code),
        sk: INTAKE_SK,
        ...item,
      },
      ...(existing
        ? {
            ConditionExpression: "agencyId = :aid",
            ExpressionAttributeValues: { ":aid": opts.agencyId },
          }
        : {}),
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_ONBOARDING_INTAKE_SAVED,
    details: { orgCode: code },
    createdAt: now,
    resourceType: "agency",
    resourceId: code,
  });

  return item;
}

export async function getCampusOnboardingChecklist(
  campusCode: string,
): Promise<OnboardingChecklistState | null> {
  const code = normalizeCampusCode(campusCode);
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(code),
        sk: CHECKLIST_SK,
      },
    }),
  );
  return (result.Item as OnboardingChecklistState | undefined) ?? null;
}

export async function patchCampusOnboardingChecklist(opts: {
  campusCode: string;
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<OnboardingChecklistState> {
  const code = normalizeCampusCode(opts.campusCode);
  const patch = onboardingChecklistPatchSchema.parse(opts.body);
  const now = new Date().toISOString();
  const vertical: OnboardingVertical = "campus";

  const existing = await getCampusOnboardingChecklist(code);
  if (existing && existing.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  const item: OnboardingChecklistState = {
    orgCode: code,
    vertical,
    agencyId: opts.agencyId,
    steps: {
      ...(existing?.steps ?? {}),
      ...(patch.steps ?? {}),
    },
    notesByStep: {
      ...(existing?.notesByStep ?? {}),
      ...(patch.notesByStep ?? {}),
    },
    updatedAt: now,
    updatedBy: opts.actorId,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(code),
        sk: CHECKLIST_SK,
        ...item,
      },
      ...(existing
        ? {
            ConditionExpression: "agencyId = :aid",
            ExpressionAttributeValues: { ":aid": opts.agencyId },
          }
        : {}),
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_ONBOARDING_CHECKLIST_UPDATED,
    details: { orgCode: code, steps: patch.steps ?? {} },
    createdAt: now,
    resourceType: "agency",
    resourceId: code,
  });

  return item;
}

export async function getCampusIntegrationQuestionnaire(
  campusCode: string,
): Promise<CampusIntegrationQuestionnaireRecord | null> {
  const code = normalizeCampusCode(campusCode);
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(code),
        sk: INTEGRATION_SK,
      },
    }),
  );
  return (result.Item as CampusIntegrationQuestionnaireRecord | undefined) ?? null;
}

export async function saveCampusIntegrationQuestionnaire(opts: {
  campusCode: string;
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<CampusIntegrationQuestionnaireRecord> {
  const code = normalizeCampusCode(opts.campusCode);
  const parsed = campusIntegrationQuestionnaireSchema.parse(opts.body);
  const now = new Date().toISOString();

  const existing = await getCampusIntegrationQuestionnaire(code);
  if (existing && existing.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  const item: CampusIntegrationQuestionnaireRecord = {
    ...parsed,
    orgCode: code,
    agencyId: opts.agencyId,
    submittedAt: existing?.submittedAt ?? now,
    submittedBy: existing?.submittedBy ?? opts.actorId,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(code),
        sk: INTEGRATION_SK,
        ...item,
      },
      ...(existing
        ? {
            ConditionExpression: "agencyId = :aid",
            ExpressionAttributeValues: { ":aid": opts.agencyId },
          }
        : {}),
    }),
  );

  await saveCampusSites({
    campusCode: code,
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    body: {
      sites: parsed.campuses.map((campus) => ({
        code: campus.code,
        name: campus.name,
        city: campus.city,
        state: campus.state,
        kind: campus.kind,
        active: campus.active !== false,
      })),
    },
  });

  await patchCampusOnboardingChecklist({
    campusCode: code,
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    body: { steps: { integration_discovery_completed: "complete" } },
  });

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_ONBOARDING_INTEGRATIONS_SAVED,
    details: { orgCode: code, campusCount: parsed.campuses.length },
    createdAt: now,
    resourceType: "agency",
    resourceId: code,
  });

  return item;
}

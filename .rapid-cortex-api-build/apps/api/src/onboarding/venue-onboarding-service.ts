import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  onboardingChecklistPatchSchema,
  venueIntakeSchema,
  type OnboardingChecklistState,
  type OnboardingVertical,
  type VenueIntakeRecord,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { normalizeVenueCode } from "../venue/venue-access.js";
import { VENUE_KEYS } from "../venue/venue-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

const INTAKE_SK = "INTAKE";
const CHECKLIST_SK = "CHECKLIST";

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

export async function getVenueIntake(venueCode: string): Promise<VenueIntakeRecord | null> {
  const code = normalizeVenueCode(venueCode);
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.configPk(code),
        sk: INTAKE_SK,
      },
    }),
  );
  return (result.Item as VenueIntakeRecord | undefined) ?? null;
}

export async function saveVenueIntake(opts: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<VenueIntakeRecord> {
  const code = normalizeVenueCode(opts.venueCode);
  const parsed = venueIntakeSchema.parse(opts.body);
  const now = new Date().toISOString();

  const existing = await getVenueIntake(code);
  if (existing && existing.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  const item: VenueIntakeRecord = {
    ...parsed,
    orgCode: code,
    agencyId: opts.agencyId,
    submittedAt: existing?.submittedAt ?? now,
    submittedBy: existing?.submittedBy ?? opts.actorId,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.configPk(code),
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
    type: AUDIT_EVENT_TYPES.VENUE_ONBOARDING_INTAKE_SAVED,
    details: { orgCode: code },
    createdAt: now,
    resourceType: "agency",
    resourceId: code,
  });

  return item;
}

export async function getVenueOnboardingChecklist(
  venueCode: string,
): Promise<OnboardingChecklistState | null> {
  const code = normalizeVenueCode(venueCode);
  const result = await ddb.send(
    new GetCommand({
      TableName: venueConfigTable(),
      Key: {
        pk: VENUE_KEYS.configPk(code),
        sk: CHECKLIST_SK,
      },
    }),
  );
  return (result.Item as OnboardingChecklistState | undefined) ?? null;
}

export async function patchVenueOnboardingChecklist(opts: {
  venueCode: string;
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<OnboardingChecklistState> {
  const code = normalizeVenueCode(opts.venueCode);
  const patch = onboardingChecklistPatchSchema.parse(opts.body);
  const now = new Date().toISOString();
  const vertical: OnboardingVertical = "venue";

  const existing = await getVenueOnboardingChecklist(code);
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
      TableName: venueConfigTable(),
      Item: {
        pk: VENUE_KEYS.configPk(code),
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
    type: AUDIT_EVENT_TYPES.VENUE_ONBOARDING_CHECKLIST_UPDATED,
    details: { orgCode: code, steps: patch.steps ?? {} },
    createdAt: now,
    resourceType: "agency",
    resourceId: code,
  });

  return item;
}

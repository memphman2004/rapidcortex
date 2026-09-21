import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { transitCodeFromAgencyId, transitIntakeSchema, type TransitIntakeRecord } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { ddb } from "../repositories/baseRepository.js";
import { TRANSIT_INTAKE_SK, TRANSIT_TABLE_ENV, transitTableEnv } from "../transit/tables.js";

const auditRepo = new AuditRepository();

export async function getTransitIntake(agencyId: string): Promise<TransitIntakeRecord | null> {
  const id = agencyId.trim();
  const result = await ddb.send(
    new GetCommand({
      TableName: transitTableEnv(TRANSIT_TABLE_ENV.config),
      Key: { agencyId: id, sk: TRANSIT_INTAKE_SK },
    }),
  );
  return (result.Item as TransitIntakeRecord | undefined) ?? null;
}

export async function saveTransitIntake(opts: {
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<TransitIntakeRecord> {
  const agencyId = opts.agencyId.trim();
  const parsed = transitIntakeSchema.parse(opts.body);
  const now = new Date().toISOString();
  const orgCode = transitCodeFromAgencyId(agencyId);

  const existing = await getTransitIntake(agencyId);
  if (existing && existing.agencyId !== agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  const item: TransitIntakeRecord = {
    ...parsed,
    orgCode,
    agencyId,
    submittedAt: existing?.submittedAt ?? now,
    submittedBy: existing?.submittedBy ?? opts.actorId,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: transitTableEnv(TRANSIT_TABLE_ENV.config),
      Item: {
        agencyId,
        sk: TRANSIT_INTAKE_SK,
        ...item,
      },
      ...(existing
        ? {
            ConditionExpression: "agencyId = :aid",
            ExpressionAttributeValues: { ":aid": agencyId },
          }
        : {}),
    }),
  );

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.TRANSIT_ONBOARDING_INTAKE_SAVED,
      details: { orgCode },
      createdAt: now,
      resourceType: "agency",
      resourceId: agencyId,
    });
  } catch (error) {
    console.warn("[transit-onboarding-intake] audit failed", error);
  }

  return item;
}

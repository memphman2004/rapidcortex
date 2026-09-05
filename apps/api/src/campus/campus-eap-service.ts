import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type {
  CampusAutomationRule,
  CampusAutomationRuleUpsertBody,
  CampusEap,
  CampusEapChecklist,
  CampusEapUpsertBody,
} from "rapid-cortex-shared";
import { matchCampusEap } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { CAMPUS_KEYS } from "./campus-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function campusConfigTable(): string {
  const t = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CONFIG_TABLE not set");
  return t;
}

export async function listCampusEaps(campusCode: string): Promise<CampusEap[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: campusConfigTable(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": CAMPUS_KEYS.configPk(campusCode),
        ":prefix": "EAP#",
      },
    }),
  );
  return (result.Items ?? []) as CampusEap[];
}

export async function getCampusEap(campusCode: string, eapId: string): Promise<CampusEap | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: CAMPUS_KEYS.eapSk(eapId),
      },
    }),
  );
  return (result.Item as CampusEap) ?? null;
}

export async function matchCampusEapForIncident(
  campusCode: string,
  buildingCode: string,
  incidentType: string,
): Promise<CampusEapChecklist | null> {
  const eaps = await listCampusEaps(campusCode);
  const hit = matchCampusEap(eaps, buildingCode, incidentType);
  if (!hit) return null;
  return {
    eapId: hit.eapId,
    title: hit.title,
    steps: hit.steps,
    documentUrl: hit.documentUrl || undefined,
  };
}

export async function upsertCampusEap(
  agencyId: string,
  actorId: string,
  body: CampusEapUpsertBody,
): Promise<CampusEap> {
  const now = new Date().toISOString();
  const eapId = body.eapId?.trim() || makeId("eap");
  const existing = await getCampusEap(body.campusCode, eapId);
  const item: CampusEap = {
    eapId,
    agencyId,
    campusCode: body.campusCode,
    title: body.title.trim(),
    buildingCode: body.buildingCode.trim().toUpperCase(),
    incidentTypes: body.incidentTypes,
    steps: body.steps.map((s) => s.trim()).filter(Boolean),
    documentUrl: body.documentUrl?.trim() || undefined,
    active: body.active ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(body.campusCode),
        sk: CAMPUS_KEYS.eapSk(eapId),
        agencyId,
        ...item,
      },
      ConditionExpression: "attribute_not_exists(pk) OR agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_EAP_UPSERTED,
    details: { eapId, campusCode: body.campusCode, buildingCode: item.buildingCode },
    createdAt: now,
    resourceType: "campus_eap",
    resourceId: eapId,
  });

  return item;
}

export async function deleteCampusEap(
  campusCode: string,
  eapId: string,
  agencyId: string,
  actorId: string,
): Promise<void> {
  const existing = await getCampusEap(campusCode, eapId);
  if (!existing) throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  if (existing.agencyId !== agencyId) {
    throw Object.assign(new Error("FORBIDDEN"), { statusCode: 403 });
  }
  await ddb.send(
    new DeleteCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: CAMPUS_KEYS.eapSk(eapId),
      },
      ConditionExpression: "agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_EAP_DELETED,
    details: { eapId, campusCode },
    createdAt: new Date().toISOString(),
    resourceType: "campus_eap",
    resourceId: eapId,
  });
}

type AutomationRulesItem = {
  pk: string;
  sk: string;
  agencyId: string;
  campusCode: string;
  rules: CampusAutomationRule[];
};

export async function listCampusAutomationRules(
  campusCode: string,
): Promise<CampusAutomationRule[]> {
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(campusCode),
        sk: CAMPUS_KEYS.automationRulesSk(),
      },
    }),
  );
  const item = result.Item as AutomationRulesItem | undefined;
  return item?.rules ?? [];
}

export async function putCampusAutomationRules(
  agencyId: string,
  actorId: string,
  body: CampusAutomationRuleUpsertBody,
): Promise<CampusAutomationRule[]> {
  const now = new Date().toISOString();
  const existing = await listCampusAutomationRules(body.campusCode);
  const byId = new Map(existing.map((r) => [r.ruleId, r]));
  const rules: CampusAutomationRule[] = body.rules.map((row) => {
    const ruleId = row.ruleId?.trim() || makeId("rule");
    const prev = byId.get(ruleId);
    return {
      ruleId,
      agencyId,
      campusCode: body.campusCode,
      name: row.name.trim(),
      active: row.active ?? true,
      match: row.match,
      actions: row.actions,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
  });

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(body.campusCode),
        sk: CAMPUS_KEYS.automationRulesSk(),
        agencyId,
        campusCode: body.campusCode,
        rules,
        updatedAt: now,
      },
      ConditionExpression: "attribute_not_exists(pk) OR agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_AUTOMATION_RULES_UPDATED,
    details: { campusCode: body.campusCode, count: rules.length },
    createdAt: now,
    resourceType: "campus_automation",
    resourceId: body.campusCode,
  });

  return rules;
}

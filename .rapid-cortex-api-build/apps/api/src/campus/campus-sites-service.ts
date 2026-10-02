import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  campusSitesPutSchema,
  resolveCampusSites,
  type CampusSite,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { campusCodeFromAgencyId } from "../handlers/vertical/agency-id.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { CAMPUS_KEYS } from "./campus-types.js";
import { getCampusConfig } from "./campus-config-service.js";
import { normalizeCampusCode } from "./campus-access.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function campusConfigTable(): string {
  const t = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CONFIG_TABLE not set");
  return t;
}

type StoredSitesItem = {
  agencyId?: string;
  sites?: CampusSite[];
};

export async function getResolvedCampusSites(
  campusCode: string,
  _agencyId: string,
): Promise<{ sites: CampusSite[]; primarySiteCode: string }> {
  const code = normalizeCampusCode(campusCode);
  const [stored, config] = await Promise.all([
    ddb.send(
      new GetCommand({
        TableName: campusConfigTable(),
        Key: {
          pk: CAMPUS_KEYS.configPk(code),
          sk: CAMPUS_KEYS.sitesSk(),
        },
      }),
    ),
    getCampusConfig(code),
  ]);
  const item = stored.Item as StoredSitesItem | undefined;
  return resolveCampusSites(item?.sites, code, config?.campusName);
}

export async function getCampusSitesForAgency(
  agencyId: string,
): Promise<{ sites: CampusSite[]; primarySiteCode: string }> {
  const campusCode = campusCodeFromAgencyId(agencyId);
  return getResolvedCampusSites(campusCode, agencyId);
}

export async function saveCampusSites(opts: {
  campusCode: string;
  agencyId: string;
  actorId: string;
  body: unknown;
}): Promise<{ sites: CampusSite[]; primarySiteCode: string }> {
  const code = normalizeCampusCode(opts.campusCode);
  const parsed = campusSitesPutSchema.parse(opts.body);
  const now = new Date().toISOString();
  const existing = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.configPk(code),
        sk: CAMPUS_KEYS.sitesSk(),
      },
    }),
  );
  const existingItem = existing.Item as StoredSitesItem | undefined;
  if (existingItem?.agencyId && existingItem.agencyId !== opts.agencyId) {
    throw new Error("FORBIDDEN_TENANT");
  }

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.configPk(code),
        sk: CAMPUS_KEYS.sitesSk(),
        agencyId: opts.agencyId,
        campusCode: code,
        sites: parsed.sites,
        updatedAt: now,
        updatedBy: opts.actorId,
      },
      ...(existingItem?.agencyId
        ? {
            ConditionExpression: "agencyId = :aid",
            ExpressionAttributeValues: { ":aid": opts.agencyId },
          }
        : {}),
    }),
  );

  for (const assignment of parsed.buildingAssignments ?? []) {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: campusConfigTable(),
          Key: {
            pk: CAMPUS_KEYS.configPk(code),
            sk: CAMPUS_KEYS.buildingSk(assignment.buildingId),
          },
          UpdateExpression: "SET siteCode = :sc, updatedAt = :now",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: {
            ":sc": assignment.siteCode,
            ":now": now,
          },
        }),
      );
    } catch (err) {
      console.warn("[campus-sites] building assignment skipped", assignment.buildingId, err);
    }
  }

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CAMPUS_SITES_UPDATED,
    details: {
      orgCode: code,
      siteCount: parsed.sites.length,
      buildingAssignments: parsed.buildingAssignments?.length ?? 0,
    },
    createdAt: now,
    resourceType: "agency",
    resourceId: code,
  });

  const config = await getCampusConfig(code);
  return resolveCampusSites(parsed.sites, code, config?.campusName);
}

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { searchNsopw } from "rapid-cortex-shared";
import { randomUUID } from "crypto";
import { z } from "zod";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function visitorsTable(): string {
  const t = process.env.CAMPUS_VISITORS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_VISITORS_TABLE not set");
  return t;
}

export const visitorCheckInBodySchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  idType: z.enum(["drivers_license", "state_id", "passport", "other"]),
  idPhotoKey: z.string().trim().max(500).optional(),
  visitingStaff: z.string().trim().max(120).optional(),
  purposeOfVisit: z.string().trim().min(1).max(500),
  vehiclePlate: z.string().trim().max(32).optional(),
  phone: z.string().trim().max(32).optional(),
  siteId: z.string().trim().max(64).optional(),
});

export type VisitorCheckInRequest = z.infer<typeof visitorCheckInBodySchema>;
export type VisitorClearanceStatus = "cleared" | "flagged" | "review_required";

export interface VisitorCheckInResponse {
  visitorId: string;
  status: VisitorClearanceStatus;
  matchCount: number;
  searchedAt: string;
  flagSummary?: string;
  screeningError?: boolean;
}

export async function handleVisitorCheckIn(
  agencyId: string,
  body: VisitorCheckInRequest,
  checkedInBy: string,
): Promise<VisitorCheckInResponse> {
  const visitorId = randomUUID();
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const ttl = Math.floor(now.getTime() / 1000) + 365 * 86400;

  const [gaResult, nationalResult] = await Promise.all([
    searchNsopw({ firstName: body.firstName, lastName: body.lastName, state: "GA" }),
    searchNsopw({ firstName: body.firstName, lastName: body.lastName }),
  ]);

  const apiError = Boolean(gaResult.apiError && nationalResult.apiError);
  const totalMatches = Math.max(gaResult.matchCount, nationalResult.matchCount);

  let status: VisitorClearanceStatus;
  let flagSummary: string | undefined;
  if (apiError) {
    status = "review_required";
  } else if (totalMatches > 0) {
    status = "flagged";
    flagSummary = `${totalMatches} potential match${totalMatches > 1 ? "es" : ""} found in sex offender registry`;
  } else {
    status = "cleared";
  }

  await ddb.send(
    new PutCommand({
      TableName: visitorsTable(),
      Item: {
        pk: `AGENCY#${agencyId}`,
        sk: `VISIT#${dateKey}#${visitorId}`,
        gsi1pk: `DATE#${dateKey}`,
        gsi1sk: `${agencyId}#${now.toISOString()}`,
        visitorId,
        agencyId,
        firstName: body.firstName,
        lastName: body.lastName,
        idType: body.idType,
        idPhotoKey: body.idPhotoKey ?? null,
        visitingStaff: body.visitingStaff ?? null,
        purposeOfVisit: body.purposeOfVisit,
        vehiclePlate: body.vehiclePlate ?? null,
        phone: body.phone ?? null,
        siteId: body.siteId ?? null,
        status,
        nsopwMatchCount: totalMatches,
        screeningError: apiError,
        checkedInBy,
        checkedInAt: now.toISOString(),
        ttl,
      },
    }),
  );

  return {
    visitorId,
    status,
    matchCount: totalMatches,
    searchedAt: gaResult.searchedAt,
    flagSummary,
    screeningError: apiError,
  };
}

export async function listVisitors(agencyId: string, date?: string) {
  const dateKey = date ?? new Date().toISOString().slice(0, 10);
  const result = await ddb.send(
    new QueryCommand({
      TableName: visitorsTable(),
      IndexName: "date-agency-index",
      KeyConditionExpression: "gsi1pk = :date AND begins_with(gsi1sk, :agency)",
      ExpressionAttributeValues: {
        ":date": `DATE#${dateKey}`,
        ":agency": agencyId,
      },
      ScanIndexForward: false,
    }),
  );
  return result.Items ?? [];
}

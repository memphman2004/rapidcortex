/**
 * Campus visitor management service — NexCort iQ K-12 Visitor Intelligence.
 *
 * DynamoDB key shapes:
 *   Visitor record:  PK = AGENCY#{agencyId}  SK = VISIT#{dateKey}#{visitorId}
 *   Badge lookup:    PK = BADGE#{badgeToken} SK = META
 *
 * GSI:
 *   date-agency-index: gsi1pk = DATE#{dateKey}, gsi1sk = {agencyId}#{checkedInAt}
 *
 * Privacy: Full ID number is never stored — only a one-way SHA-256 hash.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { searchNsopw } from "rapid-cortex-shared";
import { z } from "zod";
import type { VisitorCheckInBodyV2 } from "rapid-cortex-shared";
import { visitorCheckInBodyV2Schema } from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// ─── Table config ─────────────────────────────────────────────────────────────

function visitorsTable(): string {
  const t = process.env.CAMPUS_VISITORS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_VISITORS_TABLE not set");
  return t;
}

// ─── Legacy body schema (backward compat — existing routes still work) ────────

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

// ─── Check-in response ────────────────────────────────────────────────────────

export interface VisitorCheckInResponse {
  visitorId: string;
  status: VisitorClearanceStatus;
  matchCount: number;
  searchedAt: string;
  flagSummary?: string;
  screeningError?: boolean;
  /** UUID badge token — encode this into the printed badge QR. */
  badgeToken: string;
  /** ISO timestamp when the badge expires (end of business day + 2h). */
  badgeExpiresAt: string;
  captureMethod: string;
}

// ─── Badge expiry ─────────────────────────────────────────────────────────────

function computeBadgeExpiry(): string {
  // Badge expires at 7pm local server time (end of school day + 2h safety margin)
  const now = new Date();
  const expire = new Date(now);
  expire.setHours(19, 0, 0, 0);
  if (expire <= now) {
    // After 7pm — expire 1 hour from now instead
    expire.setTime(now.getTime() + 60 * 60 * 1000);
  }
  return expire.toISOString();
}

// ─── Handle check-in (v2 — with scan enrichment) ─────────────────────────────

export async function handleVisitorCheckIn(
  agencyId: string,
  bodyRaw: VisitorCheckInRequest | VisitorCheckInBodyV2,
  checkedInBy: string,
): Promise<VisitorCheckInResponse> {
  const visitorId = randomUUID();
  const badgeToken = randomUUID();
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const ttl = Math.floor(now.getTime() / 1000) + 365 * 86400;
  const badgeExpiresAt = computeBadgeExpiry();

  // Determine enriched fields (may be v2 body or legacy)
  const isV2 = "captureMethod" in bodyRaw;
  const v2body = isV2
    ? visitorCheckInBodyV2Schema.parse(bodyRaw)
    : null;
  const captureMethod = v2body?.captureMethod ?? "manual";

  const firstName = bodyRaw.firstName;
  const lastName = bodyRaw.lastName;

  // Run NSOPW screening — dual-state + national
  const [gaResult, nationalResult] = await Promise.all([
    searchNsopw({ firstName, lastName, state: "GA" }),
    searchNsopw({ firstName, lastName }),
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

  const visitorItem: Record<string, unknown> = {
    pk: `AGENCY#${agencyId}`,
    sk: `VISIT#${dateKey}#${visitorId}`,
    gsi1pk: `DATE#${dateKey}`,
    gsi1sk: `${agencyId}#${now.toISOString()}`,
    visitorId,
    agencyId,
    firstName,
    lastName,
    idType: bodyRaw.idType,
    captureMethod,
    purposeOfVisit: bodyRaw.purposeOfVisit,
    visitingStaff: bodyRaw.visitingStaff ?? null,
    vehiclePlate: bodyRaw.vehiclePlate ?? null,
    phone: bodyRaw.phone ?? null,
    siteId: bodyRaw.siteId ?? null,
    // Enriched fields from ID scan (undefined if manual entry)
    dob: v2body?.dob ?? null,
    idExpiresAt: v2body?.idExpiresAt ?? null,
    issuingState: v2body?.issuingState ?? null,
    idNumberHash: v2body?.idNumberHash ?? null,
    documentExpired: v2body?.documentExpired ?? null,
    buildingCode: v2body?.buildingCode ?? null,
    // Screening results
    status,
    nsopwMatchCount: totalMatches,
    screeningError: apiError,
    // Badge
    badgeToken,
    badgeExpiresAt,
    checkedInBy,
    checkedInAt: now.toISOString(),
    checkedOutAt: null,
    ttl,
  };

  // Store the visitor record
  await ddb.send(
    new PutCommand({
      TableName: visitorsTable(),
      Item: visitorItem,
    }),
  );

  // Store the badge lookup record (same table, different PK/SK)
  const badgeTtl = Math.floor(new Date(badgeExpiresAt).getTime() / 1000);
  await ddb.send(
    new PutCommand({
      TableName: visitorsTable(),
      Item: {
        pk: `BADGE#${badgeToken}`,
        sk: "META",
        visitorId,
        agencyId,
        dateKey,
        badgeExpiresAt,
        ttl: badgeTtl + 86400, // Keep badge lookup 1 day after expiry for audit
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
    badgeToken,
    badgeExpiresAt,
    captureMethod,
  };
}

// ─── Sign-out visitor ─────────────────────────────────────────────────────────

export async function signOutVisitor(
  agencyId: string,
  visitorId: string,
): Promise<{ success: boolean; checkedOutAt?: string }> {
  // Need to find the visitor's dateKey — query by agencyId + visitorId
  const today = new Date().toISOString().slice(0, 10);

  // Try today first (most common), then yesterday for late shifts
  for (const dateKey of [today, getPreviousDate(today)]) {
    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: visitorsTable(),
          Key: {
            pk: `AGENCY#${agencyId}`,
            sk: `VISIT#${dateKey}#${visitorId}`,
          },
          UpdateExpression: "SET checkedOutAt = :t",
          ConditionExpression: "attribute_exists(pk) AND attribute_not_exists(checkedOutAt)",
          ExpressionAttributeValues: {
            ":t": new Date().toISOString(),
          },
        }),
      );
      if (result.$metadata.httpStatusCode === 200) {
        return { success: true, checkedOutAt: new Date().toISOString() };
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
        // Already signed out or wrong date — continue
        continue;
      }
      throw err;
    }
  }

  return { success: false };
}

function getPreviousDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Badge verification ───────────────────────────────────────────────────────

export async function verifyBadge(badgeToken: string): Promise<{
  valid: boolean;
  expired: boolean;
  checkedOut: boolean;
  visitor?: Record<string, unknown>;
  message?: string;
}> {
  if (!badgeToken || badgeToken.length < 32) {
    return { valid: false, expired: false, checkedOut: false, message: "Invalid token format" };
  }

  // Look up the badge pointer
  const badgeLookup = await ddb.send(
    new GetCommand({
      TableName: visitorsTable(),
      Key: { pk: `BADGE#${badgeToken}`, sk: "META" },
    }),
  );

  if (!badgeLookup.Item) {
    return { valid: false, expired: false, checkedOut: false, message: "Badge not found" };
  }

  const { visitorId, agencyId, dateKey, badgeExpiresAt } = badgeLookup.Item as {
    visitorId: string;
    agencyId: string;
    dateKey: string;
    badgeExpiresAt: string;
  };

  // Check expiry
  const isExpired = new Date(badgeExpiresAt) < new Date();

  // Load the visitor record
  const visitorResult = await ddb.send(
    new GetCommand({
      TableName: visitorsTable(),
      Key: {
        pk: `AGENCY#${agencyId}`,
        sk: `VISIT#${dateKey}#${visitorId}`,
      },
    }),
  );

  if (!visitorResult.Item) {
    return {
      valid: !isExpired,
      expired: isExpired,
      checkedOut: false,
      message: "Visitor record not found",
    };
  }

  const v = visitorResult.Item as Record<string, unknown>;
  const checkedOut = Boolean(v.checkedOutAt);

  return {
    valid: !isExpired && !checkedOut,
    expired: isExpired,
    checkedOut,
    visitor: {
      visitorId,
      firstName: v.firstName,
      lastName: v.lastName,
      visitingStaff: v.visitingStaff,
      purposeOfVisit: v.purposeOfVisit,
      siteId: v.siteId,
      buildingCode: v.buildingCode,
      status: v.status,
      checkedInAt: v.checkedInAt,
      checkedOutAt: v.checkedOutAt,
      badgeExpiresAt,
    },
  };
}

// ─── List visitors (unchanged) ────────────────────────────────────────────────

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

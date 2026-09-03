import { AdminDisableUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { RING_HOMEOWNER_DEFAULT_AGENCY_ID } from "../../lib/ring-integration.js";
import { env } from "../../lib/env.js";
import { RingHomeownerParticipantRepository } from "../../repositories/ringHomeownerParticipantRepository.js";
import { RING_HOMEOWNER_UNMATCHED_AGENCY_ID } from "./ring-homeowner-id.js";
import { configureRingEmergencyTables } from "./ring-tables.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";

const ORPHAN_AGE_MS = 48 * 60 * 60 * 1000;
const participants = new RingHomeownerParticipantRepository();

function cip(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({});
}

export function isOrphan(
  row: {
    deviceCount: number;
    deviceIds: string[];
    registeredAt: string;
    status?: string;
    consentGiven: boolean;
  },
  cutoffIso: string,
): boolean {
  if (row.status === "ACTIVE" || row.status === "EXPIRED") return false;
  const devices = row.deviceCount || row.deviceIds?.length || 0;
  if (devices > 0) return false;
  if (row.consentGiven === true && row.status === "ACTIVE") return false;
  return row.registeredAt <= cutoffIso;
}

export async function scanOrphanedHomeowners(cutoffMs = Date.now() - ORPHAN_AGE_MS) {
  const cutoffIso = new Date(cutoffMs).toISOString();
  const agencyIds = Array.from(
    new Set([RING_HOMEOWNER_DEFAULT_AGENCY_ID, RING_HOMEOWNER_UNMATCHED_AGENCY_ID].filter(Boolean)),
  );
  const orphans = [];
  for (const agencyId of agencyIds) {
    const rows = await participants.listByAgencyId(agencyId);
    for (const row of rows) {
      if (isOrphan(row, cutoffIso)) orphans.push(row);
    }
  }
  return orphans;
}

export const handler = async () => {
  configureRingEmergencyTables();
  const poolId = env.cognitoUserPoolId;
  const orphans = await scanOrphanedHomeowners();
  let expired = 0;

  for (const orphan of orphans) {
    const homeownerId = orphan.homeownerId;
    const agencyId = orphan.agencyId;
    if (!agencyId) continue;
    try {
      const username = orphan.cognitoUsername?.trim() || orphan.email?.trim();
      if (poolId && username) {
        try {
          await cip().send(
            new AdminDisableUserCommand({
              UserPoolId: poolId,
              Username: username,
            }),
          );
        } catch (err) {
          const name = err instanceof Error ? err.name : "";
          if (name !== "UserNotFoundException") throw err;
        }
      }
      await participants.markExpired(agencyId, homeownerId);
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_HOMEOWNER_EXPIRED,
        agencyId,
        actorId: username || homeownerId,
        details: { homeownerId, createdAt: orphan.registeredAt },
        resourceId: homeownerId,
      });
      console.log(
        JSON.stringify({
          msg: "homeowner_account_expired",
          homeownerId,
          email: orphan.email,
          createdAt: orphan.registeredAt,
        }),
      );
      expired += 1;
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "homeowner_cleanup_error",
          homeownerId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return { expired };
};

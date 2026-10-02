/**
 * Shared errors + safe audit writer for the features suite.
 */

import { randomUUID } from "crypto";
import type { UserContext } from "rapid-cortex-shared";
import { AuditRepository } from "../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

export class FeatureError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "FeatureError";
    this.statusCode = statusCode;
  }
}

export function featureForbidden(message = "Forbidden"): FeatureError {
  return new FeatureError(403, message);
}

export function featureNotFound(message = "Not found"): FeatureError {
  return new FeatureError(404, message);
}

export function featureConflict(message: string): FeatureError {
  return new FeatureError(409, message);
}

export function featureBadRequest(message: string): FeatureError {
  return new FeatureError(400, message);
}

/** Audit failures must never abort business logic. */
export async function writeFeatureAudit(input: {
  agencyId: string;
  actorId?: string;
  type: string;
  details: Record<string, unknown>;
  incidentId?: string;
  resourceType?: string;
  resourceId?: string;
}): Promise<void> {
  try {
    await auditRepo.create({
      eventId: randomUUID(),
      agencyId: input.agencyId,
      actorId: input.actorId,
      type: input.type,
      details: input.details,
      incidentId: input.incidentId,
      createdAt: new Date().toISOString(),
      resourceType: input.resourceType as never,
      resourceId: input.resourceId,
    });
  } catch (err) {
    console.warn("[features] audit write failed", {
      type: input.type,
      agencyId: input.agencyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export type FeatureActor = Pick<UserContext, "userId" | "agencyId" | "role"> & {
  displayName?: string;
};

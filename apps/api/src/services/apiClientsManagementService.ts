import { z } from "zod";
import { isRcsuperadmin } from "rapid-cortex-shared";
import type { UserContext } from "rapid-cortex-shared";
import { externalApiScopeSchema } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { issueNewPlaintextSecretPair } from "./oauthClientCredentialsService.js";
import { ApiClientRepository, type ApiClientRecord } from "../repositories/apiClientRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const auditRepo = new AuditRepository();
const repo = new ApiClientRepository();

const createBodySchema = z.object({
  clientName: z.string().min(3).max(120),
  scopes: z.array(externalApiScopeSchema).min(1),
  rateLimitTier: z.enum(["standard", "high", "enterprise"]).default("standard"),
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
  /** Ignored unless actor is RC Admin; never trust tenant admins to create for other agencies via this alone. */
  agencyId: z.string().min(4).optional(),
  allowedIps: z.array(z.string().regex(/^[\d.]+$/)).max(40).optional().nullable(),
});

export class ApiClientsManagementService {
  assertAdmin(actor: UserContext): void {
    if (actor.role !== "agencyadmin" && !isRcsuperadmin(actor)) {
      throw new Error("FORBIDDEN");
    }
  }

  private agency(actor: UserContext, bodyAgency?: string): string {
    if (isRcsuperadmin(actor)) {
      const a = bodyAgency?.trim();
      if (!a) throw new Error("AGENCY_REQUIRED");
      return a;
    }
    return actor.agencyId;
  }

  async list(actor: UserContext, opts: { agencyId?: string | null }): Promise<PublicApiClientRow[]> {
    const agencyId = this.agency(actor, opts.agencyId?.trim());
    const rows = await repo.listByAgency(agencyId);
    return rows.map(publicApiClientRow);
  }

  async listRcAdminCrossTenantScan(limit = 500): Promise<PublicApiClientRow[]> {
    const rows = await repo.scanRecent(limit);
    return rows.map(publicApiClientRow);
  }

  async create(
    actor: UserContext,
    rawBody: unknown,
  ): Promise<{ record: PublicApiClientRow; clientSecret: string }> {
    this.assertAdmin(actor);
    const body = createBodySchema.parse(rawBody ?? {});
    const agencyId = this.agency(actor, body.agencyId);
    const { plaintext, saltHex, hashHex } = issueNewPlaintextSecretPair();
    const clientId = makeId("rc_api");
    const now = new Date().toISOString();
    const record: ApiClientRecord = {
      clientId,
      agencyId,
      clientName: body.clientName.trim(),
      status: "active",
      scopes: [...body.scopes],
      secretHash: hashHex,
      secretSalt: saltHex,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      allowedIps: body.allowedIps ?? null,
      rateLimitTier: body.rateLimitTier,
      environment: body.environment,
    };
    await repo.put(record);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: actor.userId,
      type: "external.api.client_created",
      details: { clientId, clientName: record.clientName, scopes: record.scopes },
      createdAt: now,
      resourceType: "integration",
      resourceId: clientId,
    });

    return { record: publicApiClientRow(record), clientSecret: plaintext };
  }

  async patchStatus(
    actor: UserContext,
    clientId: string,
    body: { status: "disabled" | "revoked"; agencyId?: string | null },
  ): Promise<void> {
    this.assertAdmin(actor);
    const row = await repo.get(clientId);
    if (!row) throw new Error("NOT_FOUND");
    if (isRcsuperadmin(actor)) {
      const scoped = body.agencyId?.trim();
      if (scoped && scoped !== row.agencyId) throw new Error("FORBIDDEN");
    } else if (row.agencyId !== actor.agencyId) {
      throw new Error("FORBIDDEN");
    }
    await repo.updateStatus(row.clientId, row.agencyId, {
      status: body.status,
      updatedAt: new Date().toISOString(),
    });
  }

  async rotate(actor: UserContext, clientId: string, agencyIdQuery?: string | null): Promise<{ clientSecret: string }> {
    this.assertAdmin(actor);
    const row = await repo.get(clientId);
    if (!row) throw new Error("NOT_FOUND");
    if (isRcsuperadmin(actor)) {
      const aid = agencyIdQuery?.trim();
      if (!aid || aid !== row.agencyId) throw new Error("FORBIDDEN");
    } else if (row.agencyId !== actor.agencyId) {
      throw new Error("FORBIDDEN");
    }
    const { plaintext, saltHex, hashHex } = issueNewPlaintextSecretPair();
    await repo.updateStatus(row.clientId, row.agencyId, {
      secretHash: hashHex,
      secretSalt: saltHex,
      updatedAt: new Date().toISOString(),
    });
    const now = new Date().toISOString();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: row.agencyId,
      actorId: actor.userId,
      type: "external.api.client_rotated",
      details: { clientId },
      createdAt: now,
      resourceType: "integration",
      resourceId: clientId,
    });
    return { clientSecret: plaintext };
  }
}

export type PublicApiClientRow = Omit<ApiClientRecord, "secretHash" | "secretSalt">;

function publicApiClientRow(row: ApiClientRecord): PublicApiClientRow {
  const { secretHash: _h, secretSalt: _s, ...rest } = row;
  return rest;
}

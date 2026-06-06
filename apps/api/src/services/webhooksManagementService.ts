import { z } from "zod";
import { isRcsuperadmin } from "rapid-cortex-shared";
import type { UserContext } from "rapid-cortex-shared";
import { webhookEventTypeSchema } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { encryptWebhookSigningSecret } from "../lib/webhookSecretEncryption.js";
import { WebhookRepository, type WebhookRecord } from "../repositories/webhookRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const webhookRepo = new WebhookRepository();
const auditRepo = new AuditRepository();

const createSchema = z.object({
  agencyId: z.string().min(4).optional(),
  targetUrl: z.string().url().max(2048),
  eventTypes: z.array(webhookEventTypeSchema).min(1).max(20),
});

function assertAdmin(actor: UserContext): void {
  if (actor.role !== "agencyadmin" && !isRcsuperadmin(actor)) throw new Error("FORBIDDEN");
}

export type PublicWebhookRecord = Omit<WebhookRecord, "signingSecretEnc">;

export class WebhooksManagementService {
  async list(actor: UserContext, queryAgency?: string | null): Promise<PublicWebhookRecord[]> {
    assertAdmin(actor);
    const aid = this.agencyId(actor, queryAgency);
    const rows = await webhookRepo.listByAgency(aid);
    return rows.map(({ signingSecretEnc: _e, ...w }) => w);
  }

  agencyId(actor: UserContext, explicit?: string | null): string {
    if (isRcsuperadmin(actor)) {
      const a = explicit?.trim();
      if (!a) throw new Error("AGENCY_REQUIRED");
      return a;
    }
    return actor.agencyId;
  }

  async create(
    actor: UserContext,
    raw: unknown,
  ): Promise<{ webhook: PublicWebhookRecord; signingSecret: string }> {
    assertAdmin(actor);
    const body = createSchema.parse(raw ?? {});
    const agencyId = this.agencyId(actor, body.agencyId);
    const plaintextSecret = randomSecret();
    const enc = await encryptWebhookSigningSecret(plaintextSecret);
    const now = new Date().toISOString();
    const webhookId = makeId("whk");
    const row: WebhookRecord = {
      webhookId,
      agencyId,
      targetUrl: body.targetUrl,
      eventTypes: body.eventTypes,
      status: "active",
      signingSecretEnc: enc,
      createdAt: now,
      updatedAt: now,
      lastDeliveryAt: null,
      failureCount: 0,
    };
    await webhookRepo.put(row);
    const { signingSecretEnc: _x, ...publicRow } = row;
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: actor.userId,
      type: "external.webhook.created",
      details: { webhookId, eventTypes: body.eventTypes },
      createdAt: now,
      resourceType: "integration",
      resourceId: webhookId,
    });
    return { webhook: publicRow, signingSecret: plaintextSecret };
  }
}

function randomSecret(): string {
  const b = Buffer.alloc(32);
  for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return `whsec_${b.toString("base64url")}`;
}

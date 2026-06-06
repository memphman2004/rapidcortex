import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import type { AgencyTenant, RcLiteProgrammaticScope, UserContext } from "rapid-cortex-shared";
import {
  parseRcLiteServiceTier,
  type AdobeSignAgreementFields,
  type RcAdminProvisioningInvoke,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { PendingProvisionRepository } from "../repositories/pendingProvisionRepository.js";
import { RcLiteApiKeyService } from "./rcLiteApiKeyService.js";

const pendingRepo = new PendingProvisionRepository();
const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const keyService = new RcLiteApiKeyService();
const ses = new SESClient({ region: env.region });

const SYSTEM_ACTOR: UserContext = {
  userId: "adobe-sign-provisioning",
  agencyId: "__platform__",
  role: "rcsuperadmin",
  email: "noreply@rapidcortex.us",
};

const DEFAULT_LITE_SCOPES: RcLiteProgrammaticScope[] = [
  "incidents:read",
  "incidents:write",
  "transcripts:read",
  "usage:read",
  "audit:read",
];

function generateAgencyId(customerName: string): string {
  const clean = customerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `${clean || "customer"}-${Date.now().toString(36)}`;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const from = env.contactFromEmail || "noreply@rapidcortex.us";
  if (env.adobeSignMock) {
    console.info("[adobe-provision] mock email", params.subject, params.to);
    return;
  }
  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject },
        Body: { Html: { Data: params.html }, Text: { Data: params.text } },
      },
    }),
  );
}

function buildLiteAgency(
  agencyId: string,
  fields: AdobeSignAgreementFields,
  contactEmail: string,
): AgencyTenant {
  const now = new Date().toISOString();
  return {
    agencyId,
    name: fields.customer_legal_name,
    type: "pilot",
    status: "active",
    state: "NA",
    region: fields.agency_jurisdiction?.trim() || "Unassigned",
    primaryContactName: fields.technical_contact_name?.trim() || fields.customer_legal_name,
    primaryContactEmail: contactEmail,
    deploymentMode: "side_by_side",
    protocolPackId: "default",
    retentionPolicyId: "cjis-default-v1",
    integrationMode: "none",
    createdAt: now,
    updatedAt: now,
    createdByUserId: SYSTEM_ACTOR.userId,
    config: {
      agencyId,
      protocolPackId: "default",
      aiProviderProfileId: "default",
      retentionPolicyId: "cjis-default-v1",
      integrationMode: "none",
      transcriptRedactionEnabled: true,
      auditExportEnabled: false,
      environmentFlags: { rcLiteEnabled: true },
      supervisorEscalationRules: {},
      createdAt: now,
      updatedAt: now,
    },
  };
}

function buildPlatformAgency(
  agencyId: string,
  fields: AdobeSignAgreementFields,
  contactEmail: string,
  agreementId: string,
): AgencyTenant {
  const row = buildLiteAgency(agencyId, fields, contactEmail);
  row.status = "draft";
  row.config.environmentFlags = {
    ...row.config.environmentFlags,
    rcLiteEnabled: false,
    adobeSignAgreementId: agreementId,
    provisioningStatus: "pending_activation",
  };
  return row;
}

export class RcAdminAdobeProvisioningService {
  async processInvoke(payload: RcAdminProvisioningInvoke): Promise<{ agencyId: string; keyId?: string }> {
    const existing = await pendingRepo.get(payload.agreementId);
    if (existing?.status === "completed") {
      return { agencyId: existing.agencyId, keyId: existing.keyId };
    }

    const now = new Date().toISOString();
    if (!existing) {
      await pendingRepo.put({
        agreementId: payload.agreementId,
        agencyId: payload.agencyId,
        agreementType: payload.agreementType,
        customerEmail: payload.contactEmail,
        customerName: payload.customerName,
        contactName: payload.contactName,
        tier: payload.tier,
        useCaseDesc: payload.useCaseDesc,
        status: "processing",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await pendingRepo.updateStatus(payload.agreementId, "processing");
    }

    try {
      if (payload.agreementType === "rc_lite") {
        return await this.autoProvisionRcLite(payload);
      }
      return await this.notifyPlatformSigned(payload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await pendingRepo.updateStatus(payload.agreementId, "failed", { errorMessage: msg });
      throw e;
    }
  }

  private async autoProvisionRcLite(
    payload: RcAdminProvisioningInvoke,
  ): Promise<{ agencyId: string; keyId: string }> {
    const tier = parseRcLiteServiceTier(payload.tier);
    const fields: AdobeSignAgreementFields = {
      agreement_type: "rc_lite",
      customer_legal_name: payload.customerName,
      technical_contact_name: payload.contactName,
      technical_contact_email: payload.contactEmail,
      service_tier: tier,
      use_case_description: payload.useCaseDesc,
    };

    const agencyId = payload.agencyId || generateAgencyId(payload.customerName);
    const agency = buildLiteAgency(agencyId, fields, payload.contactEmail);
    const prior = await agencyRepo.get(agencyId);
    if (!prior) await agencyRepo.put(agency);

    const customerId = agencyId;
    const { key, rawKey } = await keyService.createApiKey({
      agencyId,
      customerId,
      name: `${payload.customerName} — RC Lite`,
      tier,
      env: "live",
      scopes: DEFAULT_LITE_SCOPES,
      createdBy: SYSTEM_ACTOR.userId,
    });

    await sendEmail({
      to: payload.contactEmail,
      subject: "Your Rapid Cortex RC Lite API key",
      html: `<p>Your RC Lite API agreement is complete.</p>
        <p><strong>Key ID:</strong> ${key.keyId}</p>
        <p><strong>Secret (store securely):</strong> <code>${rawKey}</code></p>
        <p>Developer portal: <a href="https://developers.rapidcortex.us">developers.rapidcortex.us</a></p>`,
      text: `RC Lite API key issued.\nKey ID: ${key.keyId}\nSecret: ${rawKey}\nPortal: https://developers.rapidcortex.us`,
    });

    await pendingRepo.updateStatus(payload.agreementId, "completed", { keyId: key.keyId });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: SYSTEM_ACTOR.userId,
      type: AUDIT_EVENT_TYPES.ADOBE_SIGN_PROVISIONING,
      details: { agreementId: payload.agreementId, agreementType: "rc_lite", keyId: key.keyId },
      createdAt: new Date().toISOString(),
      resourceType: "agency",
      resourceId: agencyId,
    });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: SYSTEM_ACTOR.userId,
      type: AUDIT_EVENT_TYPES.RC_LITE_KEY_ISSUED,
      details: { keyId: key.keyId, tier },
      createdAt: new Date().toISOString(),
      resourceType: "api_key",
      resourceId: key.keyId,
    });

    return { agencyId, keyId: key.keyId };
  }

  private async notifyPlatformSigned(
    payload: RcAdminProvisioningInvoke,
  ): Promise<{ agencyId: string }> {
    const fields: AdobeSignAgreementFields = {
      agreement_type: "platform",
      customer_legal_name: payload.customerName,
      technical_contact_name: payload.contactName,
      technical_contact_email: payload.contactEmail,
      service_tier: parseRcLiteServiceTier(payload.tier),
    };
    const agencyId = payload.agencyId || generateAgencyId(payload.customerName);
    const agency = buildPlatformAgency(agencyId, fields, payload.contactEmail, payload.agreementId);
    const prior = await agencyRepo.get(agencyId);
    if (!prior) await agencyRepo.put(agency);

    await sendEmail({
      to: env.rcAdminNotificationEmail,
      subject: `NEW Platform Agreement Signed — ${payload.customerName}`,
      html: `<h2>New Platform Agreement Signed</h2>
        <p><strong>Customer:</strong> ${payload.customerName}</p>
        <p><strong>Contact:</strong> ${payload.contactName ?? "—"} (${payload.contactEmail})</p>
        <p><strong>Agency ID:</strong> ${agencyId}</p>
        <p><a href="https://rapidcortex.us/rc-admin/agencies">Activate in RC Admin →</a></p>`,
      text: `Platform agreement signed: ${payload.customerName} / ${agencyId}`,
    });

    await pendingRepo.updateStatus(payload.agreementId, "completed");
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: SYSTEM_ACTOR.userId,
      type: AUDIT_EVENT_TYPES.ADOBE_SIGN_PROVISIONING,
      details: { agreementId: payload.agreementId, agreementType: "platform" },
      createdAt: new Date().toISOString(),
      resourceType: "agency",
      resourceId: agencyId,
    });

    return { agencyId };
  }
}

export function generateAgencyIdFromAdobeSign(customerName: string): string {
  return generateAgencyId(customerName);
}

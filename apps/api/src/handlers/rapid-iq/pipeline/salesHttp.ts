/**
 * Sales automation HTTP API.
 * Routes: /api/rapid-iq/sales-automation/*
 * RBAC: canAccessRapidIq (already enforced by signalHttp).
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import {
  approveRapidIqSalesBulkBodySchema,
  createRapidIqSalesBulkCampaignBodySchema,
  createRapidIqSalesSequenceBodySchema,
  rapidIqOutlookCallbackBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../../lib/ids.js";
import { env } from "../../../lib/env.js";
import {
  deleteOutlookConnection,
  getOutlookConnection,
  getSalesDraft,
  getSalesSequence,
  listSalesDrafts,
  listSalesSequences,
  putOutlookConnection,
  putSalesDraft,
} from "../../../lib/rapid-iq/sales-automation-db.js";
import {
  buildOutlookAuthorizeUrl,
  encryptOutlookToken,
  exchangeOutlookAuthCode,
  isOutlookGraphMock,
  isOutlookOAuthConfigured,
  resolveOutlookClientSecret,
  salesOutlookMailbox,
  signOutlookOAuthState,
  verifyOutlookOAuthState,
  type SalesOutlookConnection,
} from "../../../lib/rapid-iq/outlook-graph.js";
import {
  approveBulkCampaign,
  approveSequence,
  computeSalesMetrics,
  createBulkCampaign,
  createSequenceFromTrigger,
  listCampaignCards,
  summarizeBulkBatches,
  suppressSequence,
} from "../../../lib/rapid-iq/sales-automation-engine.js";
import { ConferenceRepository } from "../../../repositories/conferenceRepository.js";
import {
  badRequest,
  badRequestFromZod,
  notFound,
  ok,
  serviceUnavailable,
} from "../../../lib/response.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";
import { sendDueStepsNow } from "./sales-automation-send.js";

const auditRepo = new AuditRepository();

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function audit(
  user: UserContext,
  type: string,
  resourceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: "platform",
      actorId: user.userId,
      type,
      details,
      createdAt: new Date().toISOString(),
      resourceType: "rapid_iq_sales_seq",
      resourceId,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_sales_http_audit_failed",
        type,
        resourceId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

function seqIdFromPath(path: string, params?: Record<string, string | undefined>): string | undefined {
  if (params?.sequenceId?.trim()) return params.sequenceId.trim();
  const m = path.match(/\/sales-automation\/sequences\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

function draftIdFromPath(path: string, params?: Record<string, string | undefined>): string | undefined {
  if (params?.draftId?.trim()) return params.draftId.trim();
  const m = path.match(/\/sales-automation\/drafts\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

export async function handleSalesAutomationHttp(
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<ReturnType<typeof ok>> {
  if (!env.enableSalesAutomation) {
    return serviceUnavailable("Sales automation is not enabled");
  }
  const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
  const path = event.rawPath ?? event.requestContext.http?.path ?? "";
  const seqId = seqIdFromPath(path, event.pathParameters);
  const draftId = draftIdFromPath(path, event.pathParameters);

  if (path.includes("/sales-automation/outlook")) {
    return handleOutlook(method, path, event, user);
  }

  if (path.includes("/sales-automation/bulk")) {
    return handleBulk(method, path, event, user);
  }

  if (method === "GET" && path.includes("/sales-automation/metrics")) {
    const metrics = await computeSalesMetrics();
    return ok({ metrics });
  }

  if (method === "GET" && path.includes("/sales-automation/campaigns")) {
    let conferences: Awaited<ReturnType<ConferenceRepository["listByAgency"]>> = [];
    if (env.conferencesTable) {
      try {
        conferences = await new ConferenceRepository().listByAgency();
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "rapid_iq_sales_campaigns_conferences_failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    const sequences = await listSalesSequences(500);
    return ok({ campaigns: listCampaignCards(conferences), batches: summarizeBulkBatches(sequences) });
  }

  if (method === "GET" && (path.endsWith("/sales-automation/drafts") || path.endsWith("/sales-automation/drafts/"))) {
    const drafts = await listSalesDrafts(50);
    return ok({ drafts });
  }

  if (draftId && path.includes("/sales-automation/drafts/")) {
    if (method === "POST" && path.endsWith("/approve")) {
      const draft = await getSalesDraft(draftId);
      if (!draft) return notFound("Draft not found");
      const next = { ...draft, status: "approved" as const, updatedAt: new Date().toISOString() };
      await putSalesDraft(next);
      await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_DRAFT_APPROVED, draftId, { contentType: draft.contentType });
      return ok({ draft: next });
    }
    if (method === "GET") {
      const draft = await getSalesDraft(draftId);
      if (!draft) return notFound("Draft not found");
      return ok({ draft });
    }
  }

  if (method === "GET" && (path.endsWith("/sales-automation/sequences") || path.endsWith("/sales-automation/sequences/"))) {
    const sequences = await listSalesSequences(500);
    return ok({ sequences });
  }

  if (method === "POST" && (path.endsWith("/sales-automation/sequences") || path.endsWith("/sales-automation/sequences/"))) {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = createRapidIqSalesSequenceBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const sequence = await createSequenceFromTrigger(parsed.data);
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_SEQ_CREATED, sequence.sequenceId, {
      triggerType: sequence.triggerType,
      status: sequence.status,
    });
    return ok({ sequence });
  }

  if (seqId && path.includes("/sales-automation/sequences/")) {
    if (method === "POST" && path.endsWith("/approve")) {
      try {
        const sequence = await approveSequence(seqId, user.userId);
        if (sequence.status === "active") {
          try {
            await sendDueStepsNow(sequence.sequenceId);
          } catch (err) {
            console.warn(
              JSON.stringify({
                msg: "rapid_iq_sales_approve_immediate_send_failed",
                sequenceId: seqId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }
        }
        const latest = (await getSalesSequence(seqId)) ?? sequence;
        await audit(
          user,
          sequence.status === "suppressed"
            ? AUDIT_EVENT_TYPES.RAPID_IQ_SALES_SEQ_SUPPRESSED
            : AUDIT_EVENT_TYPES.RAPID_IQ_SALES_SEQ_APPROVED,
          seqId,
          { status: latest.status, reason: latest.suppressedReason },
        );
        return ok({ sequence: latest });
      } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Approve failed");
      }
    }
    if (method === "POST" && path.endsWith("/suppress")) {
      try {
        const sequence = await suppressSequence(seqId, "manual");
        await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_SEQ_SUPPRESSED, seqId, { reason: "manual" });
        return ok({ sequence });
      } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Suppress failed");
      }
    }
    if (method === "GET") {
      const sequence = await getSalesSequence(seqId);
      if (!sequence) return notFound("Sequence not found");
      return ok({ sequence });
    }
  }

  return notFound("Not found");
}

async function outlookStatusPayload() {
  const conn = await getOutlookConnection();
  return {
    configured: isOutlookOAuthConfigured() || isOutlookGraphMock(),
    mock: isOutlookGraphMock() || Boolean(conn?.mock),
    connected: Boolean(conn),
    mailbox: conn?.mailbox,
    expectedMailbox: salesOutlookMailbox(),
    connectedAt: conn?.connectedAt,
  };
}

async function handleOutlook(
  method: string,
  path: string,
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<ReturnType<typeof ok>> {
  if (method === "GET" && path.includes("/outlook/status")) {
    return ok({ outlook: await outlookStatusPayload() });
  }

  if (method === "GET" && path.includes("/outlook/connect")) {
    if (isOutlookGraphMock() || !isOutlookOAuthConfigured()) {
      if (!isOutlookGraphMock()) {
        return serviceUnavailable("Outlook OAuth is not configured");
      }
      const now = new Date().toISOString();
      const conn: SalesOutlookConnection = {
        agencyId: "platform",
        mailbox: salesOutlookMailbox(),
        mock: true,
        connectedBy: user.userId,
        connectedAt: now,
        updatedAt: now,
      };
      await putOutlookConnection(conn);
      await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_OUTLOOK_CONNECTED, "outlook", {
        mailbox: conn.mailbox,
        mock: true,
      });
      return ok({ connected: true, mock: true, mailbox: conn.mailbox, outlook: await outlookStatusPayload() });
    }

    const secret = await resolveOutlookClientSecret();
    if (!secret) return serviceUnavailable("Outlook OAuth client secret is not configured");
    const state = signOutlookOAuthState(user.userId, secret);
    return ok({ authorizeUrl: buildOutlookAuthorizeUrl(state), mock: false });
  }

  if (method === "POST" && path.includes("/outlook/callback")) {
    if (isOutlookGraphMock()) {
      return badRequest("Outlook mock mode does not use an OAuth callback");
    }
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = rapidIqOutlookCallbackBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const secret = await resolveOutlookClientSecret();
    if (!secret) return serviceUnavailable("Outlook OAuth client secret is not configured");
    const verified = verifyOutlookOAuthState(parsed.data.state, secret);
    if (!verified) return badRequest("Invalid or expired Outlook OAuth state");
    try {
      const tokens = await exchangeOutlookAuthCode(parsed.data.code);
      const now = new Date().toISOString();
      const conn: SalesOutlookConnection = {
        agencyId: "platform",
        mailbox: tokens.mailbox,
        mock: false,
        refreshTokenEnc: await encryptOutlookToken(tokens.refreshToken),
        accessTokenEnc: await encryptOutlookToken(tokens.accessToken),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
        connectedBy: user.userId,
        connectedAt: now,
        updatedAt: now,
      };
      await putOutlookConnection(conn);
      await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_OUTLOOK_CONNECTED, "outlook", {
        mailbox: conn.mailbox,
        mock: false,
      });
      return ok({ connected: true, mock: false, mailbox: conn.mailbox, outlook: await outlookStatusPayload() });
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Outlook connect failed");
    }
  }

  if (method === "POST" && path.includes("/outlook/disconnect")) {
    const previous = await getOutlookConnection();
    await deleteOutlookConnection();
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_OUTLOOK_DISCONNECTED, "outlook", {
      mailbox: previous?.mailbox,
    });
    return ok({ disconnected: true, outlook: await outlookStatusPayload() });
  }

  return notFound("Not found");
}

const BULK_IMMEDIATE_SEND_CAP = 25;

async function handleBulk(
  method: string,
  path: string,
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<ReturnType<typeof ok>> {
  if (method === "POST" && path.includes("/bulk/approve")) {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = approveRapidIqSalesBulkBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    try {
      const result = await approveBulkCampaign(parsed.data.campaignId, user.userId);
      const sequences = await listSalesSequences(500);
      const due = sequences.filter(
        (s) => s.attribution.campaignId === parsed.data.campaignId && s.status === "active",
      );
      let sentNow = 0;
      for (const seq of due) {
        if (sentNow >= BULK_IMMEDIATE_SEND_CAP) break;
        try {
          const send = await sendDueStepsNow(seq.sequenceId);
          sentNow += send.sent;
        } catch (err) {
          console.warn(
            JSON.stringify({
              msg: "rapid_iq_sales_bulk_immediate_send_failed",
              sequenceId: seq.sequenceId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }
      await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_BULK_APPROVED, parsed.data.campaignId, {
        ...result,
        sentNow,
      });
      return ok({ result: { ...result, sentNow } });
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Bulk approve failed");
    }
  }

  if (method === "POST" && (path.endsWith("/sales-automation/bulk") || path.endsWith("/sales-automation/bulk/"))) {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = createRapidIqSalesBulkCampaignBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const result = await createBulkCampaign(parsed.data);
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_BULK_CREATED, result.campaignId, {
      created: result.created,
      suppressed: result.suppressed,
      skipped: result.skipped,
      duplicates: result.duplicates,
      campaignName: result.campaignName,
    });
    return ok({ result });
  }

  return notFound("Not found");
}

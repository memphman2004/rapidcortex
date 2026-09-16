import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  RC_SUPPORT_PHONE,
  SLA_BY_SEVERITY,
  submitTicketBodySchema,
  type SupportTicketRecord,
  type TicketActivity,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { badRequestFromZod, ok, serverError } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SupportTicketRepository } from "../../repositories/supportTicketRepository.js";
import { actorName, parseJsonBody, requireSupportUser } from "./auth.js";

const repo = new SupportTicketRepository();
const auditRepo = new AuditRepository();
const ses = new SESClient({});

function supportPhone(): string {
  return env.supportPhone.trim() || RC_SUPPORT_PHONE;
}

async function sendSupportEmail(ticket: SupportTicketRecord): Promise<boolean> {
  if (env.sesMock) return false;
  await ses.send(
    new SendEmailCommand({
      Source: env.supportFromEmail,
      Destination: { ToAddresses: [env.supportEmail] },
      Message: {
        Subject: { Data: `[${ticket.severity}] ${ticket.ticketId} — ${ticket.subject}` },
        Body: {
          Text: {
            Data: [
              `Ticket: ${ticket.ticketId}`,
              `Severity: ${ticket.severity}`,
              `Category: ${ticket.category}`,
              `Agency: ${ticket.agencyName} (${ticket.agencyId})`,
              `Submitted by: ${ticket.submittedByName} <${ticket.submittedByEmail}> (${ticket.submittedByRole})`,
              `Page: ${ticket.currentPageUrl ?? "—"}`,
              "",
              ticket.description,
            ].join("\n"),
          },
        },
      },
    }),
  );
  return true;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const auth = await requireSupportUser(event);
  if ("error" in auth) return auth.error;
  const { user } = auth;
  if (!user.agencyId?.trim()) return ok({ error: "agencyId is required" }, 400);

  let parsedJson: unknown;
  try {
    parsedJson = parseJsonBody(event);
  } catch {
    return ok({ error: "Invalid JSON body" }, 400);
  }

  const parsed = submitTicketBodySchema.safeParse(parsedJson);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  if (parsed.data.severity === "SEV1") {
    return ok(
      {
        error: "SEV1 critical issues must use the phone support line",
        supportPhone: supportPhone(),
      },
      422,
    );
  }

  const now = new Date().toISOString();
  const name = actorName(user);
  const activity: TicketActivity = {
    activityId: randomUUID(),
    type: "created",
    label: `Ticket submitted via web form by ${name}`,
    authorId: user.userId,
    authorName: name,
    createdAt: now,
  };

  let ticketId: string;
  try {
    ticketId = await repo.nextTicketId();
  } catch (error) {
    if (error instanceof Error && error.message === "TICKETS_TABLE_NOT_CONFIGURED") {
      return ok({ error: "Support tickets not configured" }, 503);
    }
    console.error("[submit-ticket] nextTicketId", error);
    return serverError();
  }

  const ticket: SupportTicketRecord = {
    ticketId,
    agencyId: user.agencyId,
    agencyName: parsed.data.agencyName?.trim() || user.agencyId,
    status: "NEW",
    channel: "web_form",
    severity: parsed.data.severity,
    category: parsed.data.category,
    submittedByUserId: user.userId,
    submittedByName: name,
    submittedByEmail: user.email,
    submittedByRole: String(user.role),
    subject: parsed.data.subject,
    description: parsed.data.description,
    currentPageUrl: parsed.data.currentPageUrl,
    userAgent: parsed.data.userAgent,
    notes: [],
    activities: [activity],
    createdAt: now,
    updatedAt: now,
    ttl: repo.ttlFromNow(),
  };

  try {
    await repo.put(ticket);
  } catch (error) {
    if (error instanceof Error && error.message === "TICKETS_TABLE_NOT_CONFIGURED") {
      return ok({ error: "Support tickets not configured" }, 503);
    }
    console.error("[submit-ticket] put", error);
    return serverError();
  }

  let emailSent = false;
  try {
    emailSent = await sendSupportEmail(ticket);
    if (emailSent) {
      ticket.emailSentAt = new Date().toISOString();
      ticket.activities = [
        ...ticket.activities,
        {
          activityId: randomUUID(),
          type: "email_sent",
          label: `Notification emailed to ${env.supportEmail}`,
          authorId: "system:submit-ticket",
          authorName: "system",
          createdAt: ticket.emailSentAt,
        },
      ];
      await repo.save({ ...ticket }).catch(() => undefined);
    }
  } catch (error) {
    console.error("[submit-ticket] ses", error);
  }

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SUPPORT_TICKET_CREATED,
      details: { ticketId, severity: ticket.severity, category: ticket.category, emailSent },
      createdAt: now,
      resourceType: "support_ticket",
      resourceId: ticketId,
    });
  } catch (error) {
    console.error("[submit-ticket] audit", error);
  }

  return ok(
    {
      ticketId,
      severity: ticket.severity,
      slaExpectation: SLA_BY_SEVERITY[ticket.severity],
      message: "Ticket submitted",
    },
    201,
  );
};

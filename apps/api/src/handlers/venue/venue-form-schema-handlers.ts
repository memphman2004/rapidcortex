/**
 * Venue Form Schema Admin Handlers — RFP 2396IP, Build Item 9
 *
 * GET  /api/venue/{agencyId}/form-schema → get current config
 * PUT  /api/venue/{agencyId}/form-schema → replace config (admin only)
 */

import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  venueFormSchemaPutBodySchema,
  DEFAULT_VENUE_FORM_SCHEMA,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { venueCodeFromAgencyId } from "../vertical/agency-id.js";
import { canSupervisorVenueOps, assertAgencyMatch } from "../vertical/agency-route-context.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { VENUE_KEYS } from "../../venue/venue-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function venueConfigTable(): string {
  const t = process.env.VENUE_CONFIG_TABLE?.trim();
  if (!t) throw new Error("VENUE_CONFIG_TABLE not set");
  return t;
}

function parseBody(event: { body?: string | null }): unknown {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

async function requireAdmin(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const user = await getUserContext(event);
  if (!user) return { response: withCorrelationHeaders(event, unauthorized()) } as const;
  if (!isUserAccountActive(user)) {
    return {
      response: withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE)),
    } as const;
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { response: withCorrelationHeaders(event, pwd) } as const;

  // Only VENUE_ADMIN (and RC admins) may manage form schema
  const role = user.role.trim().toUpperCase();
  const isAdmin = role === "VENUE_ADMIN" || ["RCADMIN", "RCSUPERADMIN"].includes(role);
  if (!isAdmin) return { response: withCorrelationHeaders(event, forbidden()) } as const;

  const agencyId = event.pathParameters?.agencyId?.trim();
  if (!agencyId) {
    return { response: withCorrelationHeaders(event, badRequest("agencyId required")) } as const;
  }
  if (!assertAgencyMatch(user, agencyId)) {
    return { response: withCorrelationHeaders(event, forbidden("Agency mismatch")) } as const;
  }

  return { user, agencyId, venueCode: venueCodeFromAgencyId(agencyId) } as const;
}

// ─── GET /api/venue/{agencyId}/form-schema ────────────────────────────────────

export const getFormSchema: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user))
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd) as APIGatewayProxyResultV2;
    if (!canSupervisorVenueOps(user))
      return withCorrelationHeaders(event, forbidden());

    const agencyId = event.pathParameters?.agencyId?.trim();
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));
    if (!assertAgencyMatch(user, agencyId))
      return withCorrelationHeaders(event, forbidden("Agency mismatch"));

    const venueCode = venueCodeFromAgencyId(agencyId);

    const result = await ddb.send(
      new GetCommand({
        TableName: venueConfigTable(),
        Key: {
          pk: VENUE_KEYS.configPk(venueCode),
          sk: VENUE_KEYS.formSchemaSk(),
        },
      }),
    );

    const schema = result.Item?.config ?? DEFAULT_VENUE_FORM_SCHEMA;
    return withCorrelationHeaders(event, ok({ schema }));
  } catch (err) {
    console.error("[venue-form-schema-get]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

// ─── PUT /api/venue/{agencyId}/form-schema ────────────────────────────────────

export const putFormSchema: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const r = await requireAdmin(event);
    if ("response" in r) return r.response as APIGatewayProxyResultV2;
    const { user, agencyId, venueCode } = r;

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const parsed = venueFormSchemaPutBodySchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(
        event,
        badRequest(parsed.error.issues[0]?.message ?? "Invalid schema"),
      );
    }

    const now = new Date().toISOString();
    const config = {
      ...parsed.data,
      updatedAt: now,
      updatedBy: user.userId,
    };

    await ddb.send(
      new PutCommand({
        TableName: venueConfigTable(),
        Item: {
          pk: VENUE_KEYS.configPk(venueCode),
          sk: VENUE_KEYS.formSchemaSk(),
          agencyId,
          venueCode,
          config,
        },
      }),
    );

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VENUE_FORM_SCHEMA_UPDATED,
        details: { version: parsed.data.version, fieldCount: parsed.data.fields.length },
        createdAt: now,
        resourceType: "form_schema",
        resourceId: venueCode,
      });
    } catch {
      // audit failure never aborts
    }

    return withCorrelationHeaders(event, ok({ schema: config }));
  } catch (err) {
    console.error("[venue-form-schema-put]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

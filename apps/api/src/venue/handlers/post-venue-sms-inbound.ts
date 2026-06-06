import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import { serverError } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { parseVenueSms } from "../venue-sms-parser.js";

type ParsedCampusSms = {
  campusCode: string;
  cleanDescription: string;
  detectedType: string;
  buildingHint: string;
  roomHint: string;
};

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();
// Campus SMS routing — module loaded when campus Phase 3 is deployed.
// Dynamic import is replaced with a no-op until campus-sms-parser.ts exists.
// TODO Phase 3: restore: import { parseCampusSms } from "../../campus/campus-sms-parser.js"
const parseCampusSms = (_body: string): ParsedCampusSms | null => null;

function twiml(message: string) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${message}</Message></Response>`,
  };
}

function venueConfigTable(): string {
  return process.env.VENUE_CONFIG_TABLE?.trim() ?? "";
}

function emptyTwiml() {
  return twiml("");
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const params = new URLSearchParams(event.body ?? "");
    const rawBody = params.get("Body")?.trim() ?? "";
    const callerPhone = params.get("From") ?? "";

    if (!rawBody) return withCorrelationHeaders(event, emptyTwiml());

    // ── CAMPUS CHECK FIRST ─────────────────────────────────────
    const campusResult = parseCampusSms(rawBody);
    if (campusResult) {
      return withCorrelationHeaders(
        event,
        twiml(
          `Campus safety report received for ${campusResult.campusCode}. ` +
            "Your report has been sent to campus safety personnel.",
        ),
      );
    }

    // ── VENUE CHECK ────────────────────────────────────────────
    const venueResult = parseVenueSms(rawBody);
    if (!venueResult) return withCorrelationHeaders(event, emptyTwiml());

    const incidentId = makeId("vi");
    const now = new Date().toISOString();
    const table = venueConfigTable();

    if (table) {
      await ddb.send(
        new PutCommand({
          TableName: table,
          Item: {
            pk: `SMS_INCIDENT#${venueResult.venueCode}`,
            sk: `${now}#${incidentId}`,
            incidentId,
            venueCode: venueResult.venueCode,
            source: "sms",
            type: venueResult.detectedType,
            zoneHint: venueResult.zoneHint,
            description: venueResult.cleanDescription,
            rawMessage: venueResult.rawMessage,
            callerPhone,
            status: "open",
            isAnonymous: true,
            createdAt: now,
            updatedAt: now,
          },
        }),
      );

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: venueResult.venueCode,
        incidentId,
        actorId: "sms-inbound",
        type: "VENUE_SMS_INCIDENT_CREATED",
        details: {
          venueCode: venueResult.venueCode,
          type: venueResult.detectedType,
        },
        createdAt: now,
        resourceType: "incident",
        resourceId: incidentId,
      });
    }

    const typeLabel: Record<string, string> = {
      medical: "medical",
      security: "security",
      lost_person: "lost person",
      maintenance: "maintenance report",
      guest_services: "guest services request",
      other: "report",
    };

    return withCorrelationHeaders(
      event,
      twiml(
        `Your ${typeLabel[venueResult.detectedType] ?? "report"} has been ` +
          `received by venue safety staff. Reference: ${incidentId}. ` +
          "For emergencies, call 911 immediately.",
      ),
    );
  } catch (err) {
    console.error("[venue-sms-inbound]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { ParsedVenueSms } from "./venue-sms-parser.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const auditRepo = new AuditRepository();

function venueConfigTable(): string {
  return process.env.VENUE_CONFIG_TABLE?.trim() ?? "";
}

export async function handleVenueInboundSms(params: {
  parsed: ParsedVenueSms;
  callerPhone: string;
  toPhone: string;
  inboundParams: Record<string, string>;
}): Promise<void> {
  void params.inboundParams;
  const incidentId = makeId("vi");
  const now = new Date().toISOString();
  const table = venueConfigTable();

  if (table) {
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: `SMS_INCIDENT#${params.parsed.venueCode}`,
          sk: `${now}#${incidentId}`,
          incidentId,
          venueCode: params.parsed.venueCode,
          source: "sms",
          type: params.parsed.detectedType,
          zoneHint: params.parsed.zoneHint,
          description: params.parsed.cleanDescription,
          rawMessage: params.parsed.rawMessage,
          callerPhone: params.callerPhone,
          inboundTo: params.toPhone,
          status: "open",
          isAnonymous: true,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: params.parsed.venueCode,
      incidentId,
      actorId: "sms-inbound",
      type: "VENUE_SMS_INCIDENT_CREATED",
      details: {
        venueCode: params.parsed.venueCode,
        type: params.parsed.detectedType,
      },
      createdAt: now,
      resourceType: "incident",
      resourceId: incidentId,
    });
  }

  // Outbound auto-reply via AWS SMS can be added when venue location flow ships.
  void params.callerPhone;
}

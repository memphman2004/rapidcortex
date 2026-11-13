/**
 * Campus Blue-Light Connect — Incident Service.
 * Writes blue-light incidents into the existing campus incidents DynamoDB table.
 * Campus vertical only.
 */

import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  BlueLightIncident,
  BlueLightIncidentStatus,
  BlueLightPole,
  CallStatus,
  NormalizedActivationEvent,
  TranscriptChunk,
} from "rapid-cortex-shared";

const TABLE_NAME = process.env.CAMPUS_INCIDENTS_TABLE ?? "rapid-cortex-campus-incidents-dev";

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
);

export class BlueLightIncidentService {
  /**
   * Create a new blue-light incident from a normalized activation event.
   * Writes into the existing campus incidents table using CAMPUS#/INCIDENT# key scheme.
   */
  async createFromActivation(
    event: NormalizedActivationEvent,
    pole: BlueLightPole,
  ): Promise<BlueLightIncident> {
    const incidentId = `BL-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const incident: BlueLightIncident = {
      incidentId,
      type: "blue_light_activation",
      priority: "high",
      source: "blue_light_connect",
      campusId: pole.campusId,
      poleId: pole.poleId,
      poleLabel: pole.label,
      location: {
        lat: pole.location.lat,
        lng: pole.location.lng,
        zone: pole.zone,
        buildingId: pole.buildingId ?? null,
        display: `${pole.label} · ${pole.zone}`,
      },
      linkedCameras: pole.linkedCameras,
      callId: event.callId,
      callStatus: event.callId ? "active" : "none",
      status: "active",
      transcript: [],
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };

    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...incident,
          // Use existing campus key scheme — consistent with campus incident queries
          pk: `CAMPUS#${pole.campusId}`,
          sk: `INCIDENT#${incidentId}`,
          gsi1pk: `CAMPUS#${pole.campusId}#STATUS#active`,
          gsi1sk: now,
        },
      }),
    );

    console.log(
      JSON.stringify({
        msg: "bluelight_incident_created",
        incidentId,
        poleId: pole.poleId,
        campusId: pole.campusId,
      }),
    );

    return incident;
  }

  async updateStatus(incidentId: string, status: BlueLightIncidentStatus): Promise<void> {
    const now = new Date().toISOString();
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { incidentId },
        UpdateExpression: "SET #st = :st, updatedAt = :ts, resolvedAt = :ra",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":st": status,
          ":ts": now,
          ":ra": ["resolved", "false_alarm"].includes(status) ? now : null,
        },
      }),
    );
  }

  async appendTranscript(incidentId: string, chunk: TranscriptChunk): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { incidentId },
        UpdateExpression:
          "SET transcript = list_append(if_not_exists(transcript, :empty), :chunk), updatedAt = :ts",
        ExpressionAttributeValues: {
          ":chunk": [chunk],
          ":empty": [],
          ":ts": new Date().toISOString(),
        },
      }),
    );
  }

  async updateCallStatus(incidentId: string, callStatus: CallStatus): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { incidentId },
        UpdateExpression: "SET callStatus = :cs, updatedAt = :ts",
        ExpressionAttributeValues: { ":cs": callStatus, ":ts": new Date().toISOString() },
      }),
    );
  }

  async getIncident(incidentId: string): Promise<BlueLightIncident | null> {
    const result = await dynamo.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { incidentId } }),
    );
    return (result.Item as BlueLightIncident | undefined) ?? null;
  }
}

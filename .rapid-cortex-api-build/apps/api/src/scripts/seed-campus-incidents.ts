/**
 * Seeds sample campus incidents for demo/testing.
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-campus-incidents.ts UGA
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { CampusIncident } from "../campus/campus-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function incidentsTable(): string {
  const t = process.env.CAMPUS_INCIDENTS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_INCIDENTS_TABLE not set");
  return t;
}

async function putIncident(item: CampusIncident): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: incidentsTable(),
      Item: item,
    }),
  );
}

function incident(campusCode: string, id: string, patch: Partial<CampusIncident>): CampusIncident {
  const now = new Date().toISOString();
  return {
    pk: `CAMPUS#${campusCode}`,
    sk: `INCIDENT#${id}`,
    id,
    campusCode,
    buildingCode: patch.buildingCode ?? "MLC",
    buildingLabel: patch.buildingLabel ?? "Miller Learning Center",
    floor: patch.floor ?? 2,
    roomCode: patch.roomCode ?? "214",
    zoneLabel: patch.zoneLabel ?? "Miller Learning Center · 214",
    type: patch.type ?? "security",
    source: patch.source ?? "qr",
    status: patch.status ?? "open",
    description: patch.description ?? "Suspicious activity reported near a hallway exit.",
    isAnonymous: patch.isAnonymous ?? true,
    confidential: patch.confidential ?? false,
    assignedTo: patch.assignedTo ?? null,
    assignedToName: patch.assignedToName ?? null,
    cameraRefs: patch.cameraRefs ?? [],
    hasMedia: patch.hasMedia ?? false,
    mediaUrls: patch.mediaUrls ?? [],
    createdAt: patch.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
    resolvedAt: patch.resolvedAt ?? null,
    cleryCategory: patch.cleryCategory ?? null,
  };
}

async function seed(campusCode = "UGA"): Promise<void> {
  const prefix = `${campusCode}-${new Date().getFullYear()}`;
  const base = Date.now();
  const list: CampusIncident[] = [
    incident(campusCode, `${prefix}-${String(base).slice(-6)}`, {
      type: "security",
      status: "open",
      description: "Unknown person following students near MLC stairwell.",
      buildingCode: "MLC",
      buildingLabel: "Miller Learning Center",
      roomCode: "Stairwell A",
      zoneLabel: "Miller Learning Center · Stairwell A",
    }),
    incident(campusCode, `${prefix}-${String(base + 1).slice(-6)}`, {
      type: "mental_health",
      status: "responding",
      confidential: true,
      description: "Student requested urgent mental health support in residence hall.",
      buildingCode: "MYERS",
      buildingLabel: "Myers Hall",
      roomCode: "204",
      zoneLabel: "Myers Hall · 204",
      assignedTo: "campus-counselor-1",
      assignedToName: "Counselor Team",
    }),
    incident(campusCode, `${prefix}-${String(base + 2).slice(-6)}`, {
      type: "medical",
      status: "resolved",
      description: "Student fainted during class. EMS responded and cleared scene.",
      source: "sms",
      buildingCode: "CALDWELL",
      buildingLabel: "Caldwell Hall",
      roomCode: "101",
      zoneLabel: "Caldwell Hall · 101",
      resolvedAt: new Date().toISOString(),
    }),
    incident(campusCode, `${prefix}-${String(base + 3).slice(-6)}`, {
      type: "property_crime",
      status: "assigned",
      description: "Bike theft reported near Tate bike racks.",
      buildingCode: "TATE",
      buildingLabel: "Tate Student Center",
      roomCode: "Bike Racks",
      zoneLabel: "Tate Student Center · Bike Racks",
      assignedTo: "campus-security-2",
      assignedToName: "Officer Patel",
      cleryCategory: "Motor Vehicle Theft",
    }),
  ];

  for (const item of list) {
    await putIncident(item);
    console.log(`Seeded campus incident: ${item.id} (${item.type}/${item.status})`);
  }
}

void seed(process.argv[2] ?? "UGA")
  .then(() => {
    console.log("Campus incident seed complete.");
  })
  .catch((err) => {
    console.error("Campus incident seed failed:", err);
    process.exit(1);
  });

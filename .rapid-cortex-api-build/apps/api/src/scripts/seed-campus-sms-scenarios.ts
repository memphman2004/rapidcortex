/**
 * Writes a small set of mock inbound SMS events to CAMPUS_INCIDENTS_TABLE
 * so parsing/routing smoke tests have realistic source data.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-campus-sms-scenarios.ts UGA
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function incidentsTable(): string {
  const t = process.env.CAMPUS_INCIDENTS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_INCIDENTS_TABLE not set");
  return t;
}

type SmsScenario = {
  sourcePhone: string;
  body: string;
  expectedType: string;
  buildingHint: string;
  roomHint: string;
  confidential: boolean;
};

const scenarios = (campusCode: string): SmsScenario[] => [
  {
    sourcePhone: "+14045550101",
    body: `${campusCode} suspicious person following students outside MLC room 214`,
    expectedType: "suspicious_activity",
    buildingHint: "Miller Learning Center",
    roomHint: "214",
    confidential: false,
  },
  {
    sourcePhone: "+14045550102",
    body: `${campusCode} student talking about self harm in Myers room 302 please send counselor`,
    expectedType: "mental_health",
    buildingHint: "Myers Hall",
    roomHint: "302",
    confidential: true,
  },
  {
    sourcePhone: "+14045550103",
    body: `${campusCode} medical emergency chest pain near Tate food court`,
    expectedType: "medical",
    buildingHint: "Tate Student Center",
    roomHint: "",
    confidential: false,
  },
];

async function seed(campusCode = "UGA"): Promise<void> {
  const now = new Date().toISOString();
  const pk = `CAMPUS#${campusCode}`;
  const values = scenarios(campusCode);

  for (let i = 0; i < values.length; i += 1) {
    const s = values[i];
    const id = `${campusCode}-SMS-${String(Date.now() + i).slice(-7)}`;
    await ddb.send(
      new PutCommand({
        TableName: incidentsTable(),
        Item: {
          pk,
          sk: `SMS_SCENARIO#${id}`,
          id,
          campusCode,
          sourcePhone: s.sourcePhone,
          body: s.body,
          expectedType: s.expectedType,
          buildingHint: s.buildingHint,
          roomHint: s.roomHint,
          confidential: s.confidential,
          createdAt: now,
        },
      }),
    );
    console.log(`Seeded SMS scenario: ${id} -> ${s.expectedType}`);
  }
}

void seed(process.argv[2] ?? "UGA")
  .then(() => {
    console.log("Campus SMS scenario seed complete.");
  })
  .catch((err) => {
    console.error("Campus SMS scenario seed failed:", err);
    process.exit(1);
  });

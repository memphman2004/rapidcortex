/**
 * Seed Jefferson County, ID (Tyler CAD / ARPA $200K) into Sales CRM immediately.
 * Spec: RAPID_IQ_SIGNAL_PIPELINE_CURSOR_SPEC.md — "Immediate Manual Action"
 *
 * Usage:
 *   STAGE=prod npx tsx scripts/seed-jefferson-county-id-lead.ts
 *   STAGE=dev  npx tsx scripts/seed-jefferson-county-id-lead.ts
 *   (default: both prod and dev)
 */
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const stages =
  process.env.STAGE?.trim() || process.env.DEPLOYMENT_STAGE?.trim()
    ? [process.env.STAGE?.trim() || process.env.DEPLOYMENT_STAGE!.trim()]
    : ["prod", "dev"];

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
});

const LEAD_FINGERPRINT = "jefferson-county-id-tyler-arpa-2026-07-06";

const notesText = [
  "ARPA-funded Tyler Technologies CAD implementation. New system moving to implementation — ideal window to introduce RC as AI intelligence layer on day one.",
  "County pop. 34,854. Fits RC Essential tier ($42K–$90K).",
  "Vendor: Tyler Technologies (new deployment).",
  "Funding: ARPA — $200,000 approved.",
  "Signal date: 2026-07-06 (county commission vote).",
  "Personas: Sheriff, 911 Director, Emergency Services Director, IT Director.",
  "City/seat: Rigby, ID.",
  "Source: rapid-iq (manual) — seed before signal pipeline deploy.",
].join("\n");

const nextAction =
  "Cold outreach to 911 Director and Sheriff's office. Lead with Tyler partnership angle — RC enhances Tyler, does not compete with it.";

async function alreadyExists(table: string): Promise<string | null> {
  const r = await ddb.send(
    new ScanCommand({
      TableName: table,
      FilterExpression:
        "(contains(agencyCompany, :a) OR contains(#n, :a) OR contains(agencyName, :a)) AND (contains(#msg, :tyler) OR contains(#msg, :arpa) OR contains(#msg, :fingerprint))",
      ExpressionAttributeNames: {
        "#n": "name",
        "#msg": "message",
        "#src": "source",
        "#st": "state",
      },
      ExpressionAttributeValues: {
        ":a": "Jefferson County",
        ":tyler": "Tyler Technologies",
        ":arpa": "ARPA",
        ":fingerprint": LEAD_FINGERPRINT,
      },
      ProjectionExpression: "leadId, agencyCompany, #n, createdAt, #src, #msg, fingerprint, requestedState, #st",
    }),
  );
  const exact = (r.Items ?? []).find((item) => {
    const blob = JSON.stringify(item);
    return blob.includes(LEAD_FINGERPRINT) || (blob.includes("Jefferson County") && blob.includes("Rigby"));
  });
  if (exact?.leadId) return String(exact.leadId);
  const hit = (r.Items ?? []).find((item) => {
    const blob = JSON.stringify(item).toLowerCase();
    return (
      blob.includes("jefferson") &&
      (blob.includes("idaho") || blob.includes("rigby") || blob.includes('"id"') || blob.includes('"state":"id"'))
    );
  });
  return hit?.leadId ? String(hit.leadId) : null;
}

async function seedStage(stage: string): Promise<void> {
  const table = process.env.SALES_LEADS_TABLE?.trim() || `rapid-cortex-sales-leads-${stage}`;
  const existing = await alreadyExists(table);
  if (existing) {
    console.log(JSON.stringify({ msg: "jefferson_lead_exists", stage, table, leadId: existing }));
    return;
  }

  const now = new Date().toISOString();
  const leadId = randomUUID();
  const noteId = randomUUID();
  const activityId = randomUUID();

  const item = {
    leadId,
    email: `rapid-iq+jefferson-id@rapidcortex.us`,
    name: "Jefferson County Sheriff's Office / 911",
    agencyCompany: "Jefferson County Sheriff's Office / 911",
    agencyName: "Jefferson County Sheriff's Office / 911",
    customerType: "county",
    agencyType: "911",
    vertical: "rc911",
    role: "911 Director",
    title: "911 Director",
    interestedIn: ["dashboard_platform", "cad_integration", "pilot_program"],
    estimatedAgencySize: "34854",
    estimatedValue: 200000,
    state: "ID",
    requestedState: "ID",
    requestedCity: "Rigby",
    message: `${notesText}\n\nFingerprint: ${LEAD_FINGERPRINT}`,
    createdAt: now,
    updatedAt: now,
    source: "rapid-iq",
    status: "new",
    pipelineStage: "NEW",
    stageUpdatedAt: now,
    nextAction,
    nextActionDate: now.slice(0, 10),
    probability: 40,
    notes: [
      {
        noteId,
        text: notesText,
        authorId: "seed:jefferson-county-id",
        authorName: "Rapid IQ Seed",
        createdAt: now,
        pinned: true,
      },
    ],
    activities: [
      {
        activityId,
        type: "created",
        description:
          "Lead created · Source: rapid-iq (manual) · Tyler CAD + ARPA $200K · Jefferson County, ID",
        authorId: "seed:jefferson-county-id",
        authorName: "Rapid IQ Seed",
        createdAt: now,
      },
    ],
    attribution: {
      channel: "other",
      channelLabel: "Rapid IQ (manual)",
      landingPage: "/rc-admin/rapid-iq",
      firstTouchAt: now,
      utmSource: "rapid-iq",
      utmCampaign: "jefferson-county-id-tyler-arpa",
    },
    fingerprint: LEAD_FINGERPRINT,
  };

  await ddb.send(new PutCommand({ TableName: table, Item: item }));
  console.log(JSON.stringify({ msg: "jefferson_lead_created", stage, table, leadId }));
}

async function main() {
  for (const stage of stages) {
    await seedStage(stage);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

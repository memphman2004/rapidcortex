/**
 * Seed KCPD Call Assist tenant config + DID lookup for Connect.
 * Usage: KCPD_TEST_DID=+1… CALL_ASSIST_TABLE=rapid-cortex-call-assist-dev npx tsx scripts/seed-kcpd-connect.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  KCPD_LEX_DEMO_SCENARIOS,
  KCPD_LEX_DISCLOSURE_TEXT,
  KCPD_TENANT_SEED,
  kcpdExternalAgencySeed,
} from "rapid-cortex-shared";

const TABLE = process.env.CALL_ASSIST_TABLE?.trim();
const AGENCY_ID = process.env.KCPD_AGENCY_ID?.trim() || "kcpd";
const TEST_DID = process.env.KCPD_TEST_DID?.trim() || "";

if (!TABLE) {
  console.error("Set CALL_ASSIST_TABLE");
  process.exit(1);
}
if (!TEST_DID) {
  console.error("Set KCPD_TEST_DID to the tenant test DID (not a live 911 number)");
  process.exit(1);
}

function normalizeDid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

const e164 = normalizeDid(TEST_DID);
if (!e164) {
  console.error("KCPD_TEST_DID could not be normalized");
  process.exit(1);
}

const now = new Date().toISOString();
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }));

const config = {
  agencyId: AGENCY_ID,
  sk: "CONFIG#tenant",
  entityType: "call_assist_config",
  disclosureEnabled: true,
  disclosureText: KCPD_LEX_DISCLOSURE_TEXT,
  emergencyDestination: KCPD_TENANT_SEED.emergencyDestination,
  demoEmergencyDestination: KCPD_TENANT_SEED.demoEmergencyDestination,
  cadProviderId: KCPD_TENANT_SEED.cadProviderId,
  cadProviderLabel: "PremierOne",
  cadHumanReviewRequired: true,
  cadNatureMapping: KCPD_TENANT_SEED.natureMapping,
  carfaxPortalUrl: KCPD_TENANT_SEED.carfaxPortalUrl,
  onlineReportUrl: KCPD_TENANT_SEED.onlineReportUrl,
  retention: KCPD_TENANT_SEED.retention,
  operatingHours: { timezone: "America/Chicago", openMinutes: 0, closeMinutes: 24 * 60, allDay: true },
  videoAssistEnabled: true,
  agencyShortName: "KCPD",
  shortName: "KCPD",
  agencyName: "Kansas City Missouri Police Department",
  vertical: "911",
  uiVertical: "911",
  seededProfile: "kcpd",
  demoScenarios: KCPD_LEX_DEMO_SCENARIOS,
  testDID: e164,
  lexBotId: process.env.LEX_BOT_ID?.trim() || undefined,
  lexBotAliasId: process.env.LEX_BOT_ALIAS_ID?.trim() || undefined,
  onboardingComplete: true,
  onboardingCompletedAt: now,
  updatedAt: now,
};

async function main() {
  await doc.send(new PutCommand({ TableName: TABLE, Item: config }));
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        agencyId: "__did_index__",
        sk: `PHONE#${e164}`,
        entityType: "call_assist_did",
        targetAgencyId: AGENCY_ID,
        testDID: e164,
        updatedAt: now,
      },
    }),
  );
  for (const row of kcpdExternalAgencySeed(AGENCY_ID)) {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: { ...row, sk: `EXT#${row.externalAgencyId}`, entityType: "call_assist_external" },
      }),
    );
  }
  console.log(`Wrote ${AGENCY_ID} config + DID lookup ${e164} to ${TABLE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

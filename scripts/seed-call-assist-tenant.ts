/**
 * Seed Call Assist tenant config + DID lookup for Connect.
 *
 * Usage:
 *   AGENCY_ID=fulton-county CALL_ASSIST_TEST_DID=+1… CALL_ASSIST_TABLE=rapid-cortex-call-assist-dev \
 *     npx tsx scripts/seed-call-assist-tenant.ts
 *
 * First-tenant (KCPD) overlay:
 *   AGENCY_ID=kcpd CALL_ASSIST_SEED_PROFILE=kcpd CALL_ASSIST_TEST_DID=+1… \
 *     npx tsx scripts/seed-call-assist-tenant.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  GENERIC_DISCLOSURE_TEXT,
  KCPD_LEX_DEMO_SCENARIOS,
  KCPD_TENANT_SEED,
  KCPD_VOICE_CONFIG,
  callAssistLexBotName,
  kcpdExternalAgencySeed,
  MISSOURI_SUNSHINE_RETENTION_POLICY,
  shouldApplyCallAssistReferenceSeed,
} from "rapid-cortex-shared";

const TABLE = process.env.CALL_ASSIST_TABLE?.trim();
const AGENCY_ID = process.env.AGENCY_ID?.trim() || process.env.KCPD_AGENCY_ID?.trim() || "";
const TEST_DID = process.env.CALL_ASSIST_TEST_DID?.trim() || process.env.KCPD_TEST_DID?.trim() || "";
const SEED_PROFILE = process.env.CALL_ASSIST_SEED_PROFILE?.trim().toLowerCase() ?? "";
const SEED_AGENCY_ID = process.env.CALL_ASSIST_SEED_AGENCY_ID?.trim() || "kcpd";
const STAGE = process.env.DEPLOYMENT_STAGE?.trim() || process.env.STAGE?.trim() || "dev";

if (!TABLE) {
  console.error("Set CALL_ASSIST_TABLE");
  process.exit(1);
}
if (!AGENCY_ID) {
  console.error("Set AGENCY_ID");
  process.exit(1);
}
if (!TEST_DID) {
  console.error("Set CALL_ASSIST_TEST_DID to the tenant test DID (not a live 911 number)");
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
  console.error("CALL_ASSIST_TEST_DID could not be normalized");
  process.exit(1);
}

const now = new Date().toISOString();
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }));
const applyKcpd = shouldApplyCallAssistReferenceSeed(AGENCY_ID, SEED_PROFILE, SEED_AGENCY_ID);
const agencyName = process.env.AGENCY_NAME?.trim() || (applyKcpd ? KCPD_VOICE_CONFIG.agencyName : AGENCY_ID);
const agencyShortName =
  process.env.AGENCY_SHORT_NAME?.trim() || (applyKcpd ? KCPD_VOICE_CONFIG.agencyShortName : agencyName);

const config = applyKcpd
  ? {
      agencyId: AGENCY_ID,
      sk: "CONFIG#tenant",
      entityType: "call_assist_config",
      disclosureEnabled: true,
      disclosureText: KCPD_VOICE_CONFIG.disclosureText,
      emergencyDestination: KCPD_TENANT_SEED.emergencyDestination,
      emergencyLine: KCPD_VOICE_CONFIG.emergencyLine,
      demoEmergencyDestination: KCPD_TENANT_SEED.demoEmergencyDestination,
      cadProviderId: KCPD_TENANT_SEED.cadProviderId,
      cadProviderLabel: "PremierOne",
      cadHumanReviewRequired: true,
      cadNatureMapping: KCPD_TENANT_SEED.natureMapping,
      carfaxPortalUrl: KCPD_TENANT_SEED.carfaxPortalUrl,
      onlineReportUrl: KCPD_TENANT_SEED.onlineReportUrl,
      nonEmergencyWebsite: KCPD_VOICE_CONFIG.nonEmergencyWebsite,
      openingGreeting: KCPD_VOICE_CONFIG.openingGreeting,
      defaultLanguageCode: KCPD_VOICE_CONFIG.defaultLanguageCode,
      supportedLanguages: KCPD_VOICE_CONFIG.supportedLanguages,
      retention: KCPD_TENANT_SEED.retention,
      operatingHours: { timezone: "America/Chicago", openMinutes: 0, closeMinutes: 24 * 60, allDay: true },
      videoAssistEnabled: true,
      agencyShortName,
      shortName: agencyShortName,
      agencyName,
      vertical: "911",
      uiVertical: "911",
      seededProfile: "kcpd",
      demoScenarios: KCPD_LEX_DEMO_SCENARIOS,
      testDID: e164,
      lexBotId: process.env.LEX_BOT_ID?.trim() || undefined,
      lexBotAliasId: process.env.LEX_BOT_ALIAS_ID?.trim() || undefined,
      lexBotName: process.env.LEX_BOT_NAME?.trim() || "RCCallAssistBot-dev",
      onboardingComplete: true,
      onboardingCompletedAt: now,
      updatedAt: now,
    }
  : {
      agencyId: AGENCY_ID,
      sk: "CONFIG#tenant",
      entityType: "call_assist_config",
      disclosureEnabled: true,
      disclosureText: GENERIC_DISCLOSURE_TEXT,
      emergencyDestination: "911",
      emergencyLine: process.env.EMERGENCY_LINE?.trim() || "911",
      demoEmergencyDestination: "+15555550111",
      cadProviderId: "mock",
      cadProviderLabel: null,
      cadHumanReviewRequired: true,
      cadNatureMapping: {},
      carfaxPortalUrl: process.env.CARFAX_PORTAL_URL?.trim() || "",
      onlineReportUrl: process.env.ONLINE_REPORT_URL?.trim() || "",
      nonEmergencyWebsite: process.env.AGENCY_WEBSITE?.trim() || undefined,
      defaultLanguageCode: process.env.DEFAULT_LANGUAGE_CODE?.trim() || "en-US",
      supportedLanguages: (process.env.SUPPORTED_LANGUAGES?.split(",") ?? ["en-US"]).map((s) => s.trim()).filter(Boolean),
      retention: {
        ...MISSOURI_SUNSHINE_RETENTION_POLICY,
        policyId: "generic-default",
        jurisdiction: "US",
        statute: undefined,
        displayName: undefined,
        policyName: undefined,
        governingLaw: null,
      },
      operatingHours: { timezone: process.env.AGENCY_TIMEZONE?.trim() || "UTC", openMinutes: 0, closeMinutes: 24 * 60, allDay: true },
      videoAssistEnabled: true,
      agencyShortName,
      shortName: agencyShortName,
      agencyName,
      vertical: "911",
      uiVertical: "911",
      testDID: e164,
      lexBotId: process.env.LEX_BOT_ID?.trim() || undefined,
      lexBotAliasId: process.env.LEX_BOT_ALIAS_ID?.trim() || undefined,
      lexBotName: process.env.LEX_BOT_NAME?.trim() || callAssistLexBotName(AGENCY_ID, STAGE),
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
  if (applyKcpd) {
    for (const row of kcpdExternalAgencySeed(AGENCY_ID)) {
      await doc.send(
        new PutCommand({
          TableName: TABLE,
          Item: { ...row, sk: `EXT#${row.externalAgencyId}`, entityType: "call_assist_external" },
        }),
      );
    }
  }
  console.log(`Wrote ${AGENCY_ID} config + DID lookup ${e164} to ${TABLE}${applyKcpd ? " (kcpd overlay)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

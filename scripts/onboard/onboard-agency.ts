/**
 * Day-0 tenant provision for one Rapid Cortex vertical.
 *
 * Copy scripts/onboard/vars/<vertical>.env.example → <vertical>.env, fill agency
 * fields, then:
 *
 *   source scripts/env-api-dev.sh
 *   bash scripts/onboard/campus.sh scripts/onboard/vars/campus.env
 *
 * Does not enable CAD write-back, SSO, SMS origination, or load buildings/fleet.
 * Those are later loaders / human gates (see scripts/onboard/README.md).
 */
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CreateGroupCommand,
  GetGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { defaultAgencyNetworkPolicy, defaultCampusSites } from "rapid-cortex-shared";
import {
  groupsToEnsure,
  isValidOnboardPassword,
  parseOnboardEnv,
  type ExtraOnboardUser,
  type OnboardPlan,
} from "./onboard-config.js";

const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const STAGE = process.env.DEPLOYMENT_STAGE?.trim() || "dev";

function table(envName: string, suffix: string): string {
  return process.env[envName]?.trim() || `rapid-cortex-${suffix}-${STAGE}`;
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[onboard] ${msg}`);
}

async function ensureGroup(
  cognito: CognitoIdentityProviderClient,
  pool: string,
  name: string,
  description: string,
): Promise<void> {
  try {
    await cognito.send(new GetGroupCommand({ UserPoolId: pool, GroupName: name }));
  } catch (error) {
    if ((error as { name?: string }).name !== "ResourceNotFoundException") throw error;
    await cognito.send(
      new CreateGroupCommand({ UserPoolId: pool, GroupName: name, Description: description }),
    );
    log(`Created Cognito group ${name}`);
  }
}

async function upsertUser(
  cognito: CognitoIdentityProviderClient,
  opts: {
    pool: string;
    email: string;
    role: string;
    agencyId: string;
    password: string;
    groups: string[];
    hospitalId?: string;
    vertical: string;
  },
): Promise<void> {
  const attrs = [
    { Name: "email", Value: opts.email },
    { Name: "email_verified", Value: "true" },
    { Name: "custom:role", Value: opts.role },
    { Name: "custom:agencyId", Value: opts.agencyId },
    { Name: "custom:status", Value: "active" },
    { Name: "custom:planId", Value: "command" },
    { Name: "custom:subStatus", Value: "active" },
  ];
  if (opts.hospitalId) {
    attrs.push({ Name: "custom:hospitalId", Value: opts.hospitalId });
  }

  let exists = false;
  try {
    await cognito.send(new AdminGetUserCommand({ UserPoolId: opts.pool, Username: opts.email }));
    exists = true;
  } catch (error) {
    if ((error as { name?: string }).name !== "UserNotFoundException") throw error;
  }

  if (!exists) {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: opts.pool,
        Username: opts.email,
        UserAttributes: attrs,
        TemporaryPassword: opts.password,
        MessageAction: "SUPPRESS",
        DesiredDeliveryMediums: [],
      }),
    );
    log(`Created user ${opts.email} (${opts.role})`);
  } else {
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: opts.pool,
        Username: opts.email,
        UserAttributes: attrs,
      }),
    );
    log(`Updated user ${opts.email} (${opts.role})`);
  }

  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: opts.pool,
      Username: opts.email,
      Password: opts.password,
      Permanent: true,
    }),
  );

  for (const optional of [
    { Name: "custom:vertical", Value: opts.vertical },
    { Name: "custom:agencyVertical", Value: opts.vertical },
  ]) {
    try {
      await cognito.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: opts.pool,
          Username: opts.email,
          UserAttributes: [optional],
        }),
      );
    } catch {
      // Pool schema may not include these attributes.
    }
  }

  for (const group of opts.groups) {
    try {
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: opts.pool,
          Username: opts.email,
          GroupName: group,
        }),
      );
    } catch (error) {
      log(`Skip group ${group}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function agencyItem(plan: OnboardPlan, now: string): Record<string, unknown> {
  return {
    agencyId: plan.agencyId,
    name: plan.agencyName,
    type: plan.agencyType,
    vertical: plan.agencyVertical,
    status: "active",
    state: plan.state,
    city: plan.city,
    centerName: plan.agencyName,
    region: plan.region,
    primaryContactName: plan.primaryContactName,
    primaryContactEmail: plan.primaryContactEmail,
    deploymentMode: "side_by_side",
    protocolPackId: "default",
    retentionPolicyId: "cjis-default-v1",
    integrationMode: plan.integrationMode,
    createdAt: now,
    updatedAt: now,
    createdByUserId: "onboard-agency",
    monetizationPlanId: plan.planId,
    subscriptionStatus: "active",
    planId: plan.planId,
    config: {
      agencyId: plan.agencyId,
      protocolPackId: "default",
      aiProviderProfileId: "default",
      retentionPolicyId: "cjis-default-v1",
      integrationMode: plan.integrationMode,
      transcriptRedactionEnabled: true,
      auditExportEnabled: false,
      environmentFlags: {},
      triage: { enabled: true, nonEmergencyQueueEnabled: true },
      supervisorEscalationRules: {},
      createdAt: now,
      updatedAt: now,
    },
    networkPolicy: defaultAgencyNetworkPolicy("onboard-agency"),
  };
}

async function upsertAgency(
  ddb: DynamoDBDocumentClient,
  agenciesTable: string,
  plan: OnboardPlan,
  now: string,
): Promise<"created" | "updated"> {
  const existing = await ddb.send(
    new GetCommand({ TableName: agenciesTable, Key: { agencyId: plan.agencyId } }),
  );
  if (!existing.Item) {
    await ddb.send(new PutCommand({ TableName: agenciesTable, Item: agencyItem(plan, now) }));
    return "created";
  }
  await ddb.send(
    new UpdateCommand({
      TableName: agenciesTable,
      Key: { agencyId: plan.agencyId },
      UpdateExpression:
        "SET #n = :n, vertical = :v, #t = :t, #st = :st, #s = :s, city = :c, region = :r, primaryContactName = :pn, primaryContactEmail = :pe, integrationMode = :im, updatedAt = :now",
      ExpressionAttributeNames: {
        "#n": "name",
        "#t": "type",
        "#st": "status",
        "#s": "state",
      },
      ExpressionAttributeValues: {
        ":n": plan.agencyName,
        ":v": plan.agencyVertical,
        ":t": plan.agencyType,
        ":st": "active",
        ":s": plan.state,
        ":c": plan.city,
        ":r": plan.region,
        ":pn": plan.primaryContactName,
        ":pe": plan.primaryContactEmail,
        ":im": plan.integrationMode,
        ":now": now,
      },
    }),
  );
  return "updated";
}

async function writeVerticalStub(ddb: DynamoDBDocumentClient, plan: OnboardPlan, now: string): Promise<void> {
  if (plan.vertical === "campus") {
    const tableName = table("CAMPUS_CONFIG_TABLE", "campus-config");
    const pk = `CAMPUS_CONFIG#${plan.orgCode}`;
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk,
          sk: "SETTINGS",
          agencyId: plan.agencyId,
          campusCode: plan.orgCode,
          campusName: plan.agencyName,
          smsEnabled: false,
          qrEnabled: true,
          active: true,
          cleryEnabled: true,
          timezone: plan.timezone,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk,
          sk: "SITES",
          agencyId: plan.agencyId,
          sites: defaultCampusSites(plan.orgCode, plan.agencyName),
          updatedAt: now,
        },
      }),
    );
    log(`Campus config stub ${plan.orgCode} → ${tableName} (no buildings yet)`);
  }

  if (plan.vertical === "venue") {
    const tableName = table("VENUE_CONFIG_TABLE", "venue-config");
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: `VENUE_CONFIG#${plan.orgCode}`,
          sk: "CONFIG",
          agencyId: plan.agencyId,
          venueCode: plan.orgCode,
          venueName: plan.agencyName,
          venueType: process.env.VENUE_TYPE?.trim() || "stadium",
          city: plan.city,
          state: plan.state,
          timezone: plan.timezone,
          active: true,
          smsEnabled: false,
          qrEnabled: true,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    log(`Venue config stub ${plan.orgCode} → ${tableName} (no zones yet)`);
  }

  if (plan.vertical === "transit") {
    const tableName = table("TRANSIT_CONFIG_TABLE", "transit-config");
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          agencyId: plan.agencyId,
          sk: "CONFIG#org",
          orgCode: plan.orgCode,
          name: plan.agencyName,
          timezone: plan.timezone,
          updatedAt: now,
          updatedByUserId: "onboard-agency",
        },
      }),
    );
    log(`Transit config stub → ${tableName} (no fleet/routes yet)`);
  }
}

async function seedBilling(ddb: DynamoDBDocumentClient, plan: OnboardPlan, now: string): Promise<void> {
  const tableName = table("CUSTOMERS_TABLE", "customers");
  const customerId = `cus-${plan.agencyId}`;
  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          customerId,
          agencyId: plan.agencyId,
          agencyName: plan.agencyName,
          billingContact: `${plan.agencyName} Billing`,
          email: plan.primaryContactEmail,
          paymentTerms: "NET_30",
          requiresPO: false,
          taxExempt: true,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(customerId)",
      }),
    );
    log(`Billing stub ${customerId}`);
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      log(`Billing stub already exists ${customerId}`);
      return;
    }
    throw error;
  }
}

async function seedPlaceholderQr(ddb: DynamoDBDocumentClient, plan: OnboardPlan, now: string): Promise<void> {
  const tableName = table("QR_NFC_CODES_TABLE", "qr-nfc-codes");
  const qrId = `ONB${Date.now().toString(36).toUpperCase()}`.slice(0, 26);
  const appBase = (process.env.APP_PUBLIC_BASE_URL ?? "https://app.rapidcortex.us").replace(/\/$/, "");
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        agencyId: plan.agencyId,
        qrId,
        agencyName: plan.agencyName,
        name: "Onboarding placeholder — replace with field codes",
        vertical: plan.agencyVertical === "core" ? "campus" : plan.agencyVertical,
        reportType: "both",
        nfcEnabled: false,
        active: true,
        url: `${appBase}/report/${qrId}`,
        scanCount: 0,
        nfcTapCount: 0,
        totalEngagements: 0,
        createdBy: "onboard-agency",
        createdByRole: "onboard-agency",
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
  log(`Placeholder QR ${qrId}`);
}

function laterSteps(plan: OnboardPlan): string[] {
  const steps = [
    "Invite remaining staff (or EXTRA_USERS_JSON) — do not share the admin password in git",
    "SSO / IdP metadata is a human gate — not part of this script",
    "SMS origination: only after a dedicated 10DLC/TFN exists. Never reuse another agency number. bash scripts/seed-sms-routing-dev.sh",
    "CAD write-back stays off until a signed addendum",
  ];
  if (plan.vertical === "campus") {
    steps.unshift(
      `Load buildings: npx tsx scripts/onboard/load-campus-buildings.ts --file scripts/onboard/templates/campus-buildings.csv (set CAMPUS_CODE=${plan.orgCode} AGENCY_ID=${plan.agencyId})`,
      "Complete Campus Onboarding Intake + Integration Questionnaire in the app",
    );
  }
  if (plan.vertical === "venue") {
    steps.unshift(
      `Load zones: npx tsx scripts/onboard/load-venue-zones.ts --file scripts/onboard/templates/venue-zones.csv (set VENUE_CODE=${plan.orgCode} AGENCY_ID=${plan.agencyId})`,
      "Complete Venue Onboarding Intake in the app",
    );
  }
  if (plan.vertical === "transit") {
    steps.unshift("Load fleet/routes later (do not copy Hoover Valley demo vehicles onto a real tenant)");
  }
  if (plan.vertical === "hospital") {
    steps.unshift("Capacity board owners train in Hospital Admin; no EHR/HL7 in this script");
  }
  if (plan.vertical === "psap") {
    steps.unshift("PSAP workbook: privacy, protocol pack, ALI source, Transcribe vocab — see docs/operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md");
  }
  return steps;
}

async function main(): Promise<void> {
  const plan = parseOnboardEnv(process.env);
  const password = process.env.ONBOARD_ADMIN_PASSWORD?.trim() ?? "";
  if (!plan.dryRun && !isValidOnboardPassword(password)) {
    throw new Error(
      "ONBOARD_ADMIN_PASSWORD must meet pool policy (12+ chars, upper, lower, number, symbol). Value is not logged.",
    );
  }
  const pool = process.env.COGNITO_USER_POOL_ID?.trim();
  if (!pool) throw new Error("COGNITO_USER_POOL_ID is required (source scripts/env-api-dev.sh)");

  log(`vertical=${plan.vertical} agencyId=${plan.agencyId} orgCode=${plan.orgCode} dryRun=${plan.dryRun}`);
  log(`admin=${plan.adminEmail} role=${plan.adminRole} integrationMode=${plan.integrationMode}`);

  if (plan.dryRun) {
    log("DRY_RUN — no writes");
    for (const step of laterSteps(plan)) log(`later: ${step}`);
    return;
  }

  const now = new Date().toISOString();
  const cognito = new CognitoIdentityProviderClient({ region: REGION });
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const agenciesTable = table("AGENCIES_TABLE", "agencies");

  for (const group of groupsToEnsure(plan.vertical)) {
    await ensureGroup(cognito, pool, group.name, group.description);
  }

  const agencyResult = await upsertAgency(ddb, agenciesTable, plan, now);
  log(`Agency ${agencyResult}: ${plan.agencyId} in ${agenciesTable}`);

  await writeVerticalStub(ddb, plan, now);

  await upsertUser(cognito, {
    pool,
    email: plan.adminEmail,
    role: plan.adminRole,
    agencyId: plan.agencyId,
    password,
    groups: plan.adminGroups,
    hospitalId: plan.hospitalId,
    vertical: plan.agencyVertical,
  });

  const extra: ExtraOnboardUser[] = plan.extraUsers;
  for (const user of extra) {
    await upsertUser(cognito, {
      pool,
      email: user.email,
      role: user.role,
      agencyId: plan.agencyId,
      password,
      groups: [user.role, ...plan.adminGroups.filter((g) => g.startsWith("vertical_"))],
      hospitalId: plan.hospitalId,
      vertical: plan.agencyVertical,
    });
  }

  if (plan.seedBilling) await seedBilling(ddb, plan, now);
  if (plan.seedPlaceholderQr) await seedPlaceholderQr(ddb, plan, now);

  log("Day-0 complete. Password not logged.");
  for (const step of laterSteps(plan)) log(`later: ${step}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[onboard] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

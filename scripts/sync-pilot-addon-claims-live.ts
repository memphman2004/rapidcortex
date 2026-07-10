/**
 * Sync Cognito custom:addons for pilot agencies so API requireAddon() gates pass
 * for plan-included SKUs (ai.triage.* on professional+, etc.).
 *
 *   source scripts/env-api-dev.sh
 *   npx tsx scripts/sync-pilot-addon-claims-live.ts
 *   npx tsx scripts/sync-pilot-addon-claims-live.ts --agency-id=test-agency
 */
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const AGENCIES_TABLE = process.env.AGENCIES_TABLE?.trim() || "rapid-cortex-agencies-dev";
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID?.trim() ?? "";

function parseAgencyFilter(): string | null {
  const idx = process.argv.indexOf("--agency-id");
  if (idx === -1) return null;
  const value = process.argv[idx + 1]?.trim();
  if (!value) throw new Error("--agency-id requires a value");
  return value;
}

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function addonKeysForPlan(plan: string): string[] {
  // Pilot live: only sync keys needed for F3 triage surfaces + queue SLA bar.
  // Full catalog CSV exceeds Cognito custom attribute limits.
  void plan;
  return ["ai.triage.basic", "reliability.slo_dashboards"];
}

async function listAgencyUsernames(agencyId: string): Promise<string[]> {
  const cognito = new CognitoIdentityProviderClient({ region: REGION });
  const usernames: string[] = [];
  let paginationToken: string | undefined;
  const filter = `custom:agencyId = "${escapeFilterValue(agencyId)}"`;

  do {
    const out = await cognito.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: filter,
        PaginationToken: paginationToken,
        Limit: 60,
      }),
    );
    for (const user of out.Users ?? []) {
      const username = user.Username?.trim();
      if (username) usernames.push(username);
    }
    paginationToken = out.PaginationToken;
  } while (paginationToken);

  return usernames;
}

async function syncUserAddons(username: string, addonCsv: string): Promise<void> {
  const cognito = new CognitoIdentityProviderClient({ region: REGION });
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [{ Name: "custom:addons", Value: addonCsv }],
    }),
  );
}

async function main() {
  if (!USER_POOL_ID) {
    throw new Error("COGNITO_USER_POOL_ID is required (source scripts/env-api-dev.sh)");
  }

  const agencyFilter = parseAgencyFilter();
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const agencies = await ddb.send(
    new ScanCommand({
      TableName: AGENCIES_TABLE,
      ProjectionExpression: "agencyId, #status, planId, monetizationPlanId",
      ExpressionAttributeNames: { "#status": "status" },
    }),
  );

  let usersUpdated = 0;

  for (const row of agencies.Items ?? []) {
    const agencyId = String(row.agencyId ?? "");
    if (!agencyId) continue;
    if (agencyFilter && agencyId !== agencyFilter) continue;
    const status = String(row.status ?? "active");
    if (status !== "active" && status !== "pilot") continue;

    const plan = String(row.monetizationPlanId ?? row.planId ?? "command");
    const addonKeys = addonKeysForPlan(plan);
    const addonCsv = addonKeys.join(",");
    const usernames = await listAgencyUsernames(agencyId);
    if (usernames.length === 0) {
      console.log(`[sync-pilot-addon-claims-live] ${agencyId}: no Cognito users`);
      continue;
    }

    for (const username of usernames) {
      await syncUserAddons(username, addonCsv);
      usersUpdated += 1;
    }
    console.log(
      `[sync-pilot-addon-claims-live] ${agencyId} plan=${plan} → ${usernames.length} user(s), ${addonKeys.length} addon key(s)`,
    );
  }

  console.log(`[sync-pilot-addon-claims-live] Done. Updated ${usersUpdated} Cognito user(s).`);
  console.log("[sync-pilot-addon-claims-live] Users must sign out/in for JWT custom:addons to refresh.");
}

main().catch((error) => {
  console.error(
    "[sync-pilot-addon-claims-live] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});

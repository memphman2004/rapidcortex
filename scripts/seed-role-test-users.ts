/**
 * Create or update fixed Rapid Cortex test accounts in Cognito (one password from env, never logged).
 * Intended for dev/stage QA — not for production tenant users.
 */
import {
  AddCustomAttributesCommand,
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";

const TEST_AGENCY = "test-agency";
/** Product tenant id for platform (see `packages/shared`); not the literal "platform" string. */
const PLATFORM_AGENCY = "__platform__";
const DEFAULT_STATUS = "active";

type TestRow = {
  email: string;
  /** Value stored in `custom:role` — must match product `UserRole`. */
  customRole: string;
  /** Value stored in `custom:agencyId`. */
  agencyId: string;
  /** Optional Cognito group to ensure membership. */
  cognitoGroup?: string;
};

const ACCOUNTS: TestRow[] = [
  {
    email: "rcsuperadmin@appsondemand.net",
    customRole: "rcsuperadmin",
    agencyId: PLATFORM_AGENCY,
    cognitoGroup: "rcsuperadmin",
  },
  {
    email: "rcadmin@appsondemand.net",
    customRole: "rcadmin",
    agencyId: PLATFORM_AGENCY,
    cognitoGroup: "rcadmin",
  },
  {
    email: "rcitadmin@appsondemand.net",
    customRole: "rcitadmin",
    agencyId: PLATFORM_AGENCY,
    cognitoGroup: "rcitadmin",
  },
  {
    email: "admin@appsondemand.net",
    customRole: "agencyadmin",
    agencyId: TEST_AGENCY,
    cognitoGroup: "agencyadmin",
  },
  {
    email: "supervisor@appsondemand.net",
    customRole: "commsupervisor",
    agencyId: TEST_AGENCY,
    cognitoGroup: "commsupervisor",
  },
  {
    email: "dispatcher@appsondemand.net",
    customRole: "dispatcher",
    agencyId: TEST_AGENCY,
    cognitoGroup: "dispatcher",
  },
  {
    email: "analyst@appsondemand.net",
    customRole: "analyst",
    agencyId: TEST_AGENCY,
    cognitoGroup: "analyst",
  },
  {
    email: "auditor@appsondemand.net",
    customRole: "auditor",
    agencyId: TEST_AGENCY,
    cognitoGroup: "auditor",
  },
  {
    email: "itadmin@appsondemand.net",
    customRole: "agencyit",
    agencyId: TEST_AGENCY,
    cognitoGroup: "agencyit",
  },
];

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function isTempPasswordValidForPoolPolicy(password: string): boolean {
  if (password.length < 12) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

/** Plan + subscription claims gate `hasRapidCortexDashboardAccess` for non-platform users. */
const DEV_DASHBOARD_PLAN_ID = "essential";
const DEV_SUBSCRIPTION_STATUS = "active";

function desiredAttributes(row: TestRow) {
  const base = [
    { Name: "email", Value: row.email },
    { Name: "email_verified", Value: "true" },
    { Name: "custom:role", Value: row.customRole },
    { Name: "custom:agencyId", Value: row.agencyId },
    { Name: "custom:status", Value: DEFAULT_STATUS },
  ];
  if (row.customRole !== "rcsuperadmin" && row.customRole !== "rcadmin" && row.customRole !== "rcitadmin") {
    base.push(
      { Name: "custom:planId", Value: DEV_DASHBOARD_PLAN_ID },
      { Name: "custom:subStatus", Value: DEV_SUBSCRIPTION_STATUS },
    );
  }
  return base;
}

function mapAttr(list: UserType["UserAttributes"]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of list ?? []) {
    if (a.Name && a.Value != null) m.set(a.Name, a.Value);
  }
  return m;
}

function needsAttrUpdate(
  current: UserType | undefined,
  row: TestRow
): boolean {
  const m = mapAttr(current?.UserAttributes);
  const want = desiredAttributes(row);
  for (const d of want) {
    if (m.get(d.Name) !== d.Value) return true;
  }
  return false;
}

async function inGroup(
  client: CognitoIdentityProviderClient,
  pool: string,
  username: string,
  group: string
): Promise<boolean> {
  const r = await client.send(
    new AdminListGroupsForUserCommand({ UserPoolId: pool, Username: username })
  );
  return (r.Groups ?? []).some((g) => g.GroupName === group);
}

/**
 * When adding custom attributes, Cognito `Name` is the suffix; the pool stores `custom:${Name}`.
 * DescribeUserPool returns `custom:...` in SchemaAttributes. See `infra/template.yaml` CognitoUserPool.
 */
const POOL_CUSTOM_ATTRS: { addName: string; poolName: string }[] = [
  { addName: "agencyId", poolName: "custom:agencyId" },
  { addName: "role", poolName: "custom:role" },
  { addName: "status", poolName: "custom:status" },
  { addName: "planId", poolName: "custom:planId" },
  { addName: "subStatus", poolName: "custom:subStatus" },
];

async function ensureRapidCortexCustomAttributes(
  client: CognitoIdentityProviderClient,
  userPoolId: string
): Promise<void> {
  const desc = await client.send(
    new DescribeUserPoolCommand({ UserPoolId: userPoolId })
  );
  const names = new Set(
    (desc.UserPool?.SchemaAttributes ?? [])
      .map((a) => a.Name)
      .filter((n): n is string => Boolean(n))
  );
  const toAdd = POOL_CUSTOM_ATTRS.filter((a) => !names.has(a.poolName));
  if (toAdd.length === 0) return;
  await client.send(
    new AddCustomAttributesCommand({
      UserPoolId: userPoolId,
      CustomAttributes: toAdd.map((a) => ({
        Name: a.addName,
        AttributeDataType: "String",
        Mutable: true,
      })),
    })
  );
  // eslint-disable-next-line no-console
  console.log(
    `[seed-role-test-users] Added ${toAdd.length} custom attribute(s) to the user pool: ${toAdd
      .map((a) => a.poolName)
      .join(", ")}.`
  );
}

async function main() {
  const region = requireEnv("AWS_REGION");
  const pool = requireEnv("COGNITO_USER_POOL_ID");
  const reset = process.env.RESET_RAPID_CORTEX_TEST_PASSWORDS === "true";
  const client = new CognitoIdentityProviderClient({ region });
  const password = requireEnv("RAPID_CORTEX_TEST_TEMP_PASSWORD");
  if (!isTempPasswordValidForPoolPolicy(password)) {
    throw new Error(
      "RAPID_CORTEX_TEST_TEMP_PASSWORD does not meet pool policy (12+ chars, upper, lower, number, symbol). Not logging the value."
    );
  }

  await ensureRapidCortexCustomAttributes(client, pool);

  for (const row of ACCOUNTS) {
    const username = row.email;
    let existing: UserType | undefined;
    try {
      const g = await client.send(
        new AdminGetUserCommand({ UserPoolId: pool, Username: username })
      );
      existing = g;
    } catch (e) {
      if ((e as { name?: string }).name !== "UserNotFoundException") throw e;
    }

    if (!existing) {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: pool,
          Username: username,
          UserAttributes: desiredAttributes(row),
          TemporaryPassword: password,
          MessageAction: "SUPPRESS",
          DesiredDeliveryMediums: [],
        })
      );
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: pool,
          Username: username,
          Password: password,
          Permanent: true,
        })
      );
      // eslint-disable-next-line no-console
      console.log(
        `[seed-role-test-users] Created ${row.email} (${row.customRole}) — permanent password from env, not logged.`
      );
    } else {
      if (needsAttrUpdate(existing, row)) {
        await client.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: pool,
            Username: username,
            UserAttributes: desiredAttributes(row),
          })
        );
        // eslint-disable-next-line no-console
        console.log(
          `[seed-role-test-users] Updated attributes for ${row.email} (${row.customRole}).`
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[seed-role-test-users] Skipping attribute update for ${row.email} (already matches).`
        );
      }
      if (reset) {
        await client.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: pool,
            Username: username,
            Password: password,
            Permanent: true,
          })
        );
        // eslint-disable-next-line no-console
        console.log(
          `[seed-role-test-users] RESET: permanent password set for ${row.email} (value not logged).`
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[seed-role-test-users] Password unchanged for ${row.email} (set RESET_RAPID_CORTEX_TEST_PASSWORDS=true to force).`
        );
      }
    }

    if (row.cognitoGroup) {
      if (!(await inGroup(client, pool, username, row.cognitoGroup))) {
        await client.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: pool,
            Username: username,
            GroupName: row.cognitoGroup,
          })
        );
        // eslint-disable-next-line no-console
        console.log(
          `[seed-role-test-users] Added ${row.email} to group ${row.cognitoGroup}.`
        );
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log("[seed-role-test-users] Done.");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(
    "[seed-role-test-users] Failed:",
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});

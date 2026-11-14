/**
 * Production RC internal staff provisioner — NexCort iQ platform team.
 *
 * Provisions all three RC internal roles in one idempotent run:
 *   rcsuperadmin  — full platform access, agencyId: __platform__
 *   rcadmin       — platform admin (no billing/IAM scope), agencyId: __platform__
 *   rcitadmin     — platform IT / infra, agencyId: __platform__
 *
 * Required env vars (at minimum rcsuperadmin must be set):
 *   COGNITO_USER_POOL_ID     — from scripts/env-api-dev.sh
 *   AWS_REGION               — from scripts/env-api-dev.sh
 *   RC_SUPERADMIN_EMAIL      — defaults to Support@appsondemand.net
 *   RC_ADMIN_EMAIL           — if set, provisions rcadmin principal
 *   RC_ITADMIN_EMAIL         — if set, provisions rcitadmin principal
 *   RC_STAFF_TEMP_PASSWORD   — shared temp password (pool policy: 12+ chars, U+L+N+symbol)
 *
 * Optional:
 *   RESET_RC_STAFF_PASSWORD=true  — force-sets password even if user already exists
 *
 * Security: passwords are never logged. Run from an internal drive (not /Volumes/).
 */
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  GetGroupCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";

/** Must match `PLATFORM_AGENCY_ID` in `packages/shared/src/tenancy/constants.ts`. */
const PLATFORM_AGENCY_ID = "__platform__" as const;

const ROLES = ["rcsuperadmin", "rcadmin", "rcitadmin"] as const;
type RcRole = (typeof ROLES)[number];

const ROLE_GROUP: Record<RcRole, string> = {
  rcsuperadmin: "rcsuperadmin",
  rcadmin: "rcadmin",
  rcitadmin: "rcitadmin",
};

const ROLE_DESC: Record<RcRole, string> = {
  rcsuperadmin: "RC Super Admin — full platform access",
  rcadmin: "RC Admin — platform administration",
  rcitadmin: "RC IT Admin — platform infrastructure",
};

const LOG = "[provision-rc-staff]";

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`${LOG} ${msg}`);
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optionalEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function isTempPasswordValid(password: string): boolean {
  if (password.length < 12) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

function mapAttr(list: UserType["UserAttributes"]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of list ?? []) {
    if (a.Name && a.Value != null) m.set(a.Name, a.Value);
  }
  return m;
}

function desiredAttrs(email: string, role: RcRole) {
  return [
    { Name: "email", Value: email },
    { Name: "email_verified", Value: "true" },
    { Name: "custom:role", Value: role },
    { Name: "custom:agencyId", Value: PLATFORM_AGENCY_ID },
    { Name: "custom:status", Value: "active" },
  ];
}

function attrsDiffer(current: UserType | undefined, desired: Array<{ Name: string; Value: string }>): boolean {
  const m = mapAttr(current?.UserAttributes ?? current?.Attributes);
  for (const d of desired) {
    if (m.get(d.Name) !== d.Value) return true;
  }
  return false;
}

async function ensureGroup(client: CognitoIdentityProviderClient, pool: string, name: string, description: string): Promise<void> {
  try {
    await client.send(new GetGroupCommand({ UserPoolId: pool, GroupName: name }));
  } catch (e) {
    if ((e as { name?: string }).name !== "ResourceNotFoundException") throw e;
    await client.send(new CreateGroupCommand({ UserPoolId: pool, GroupName: name, Description: description }));
    log(`Created group ${name}`);
  }
}

async function isInGroup(client: CognitoIdentityProviderClient, pool: string, username: string, group: string): Promise<boolean> {
  const r = await client.send(new AdminListGroupsForUserCommand({ UserPoolId: pool, Username: username }));
  return (r.Groups ?? []).some((g) => g.GroupName === group);
}

async function provisionPrincipal(
  client: CognitoIdentityProviderClient,
  pool: string,
  email: string,
  role: RcRole,
  password: string,
  reset: boolean,
): Promise<void> {
  log(`Provisioning ${role}: ${email}`);

  await ensureGroup(client, pool, ROLE_GROUP[role], ROLE_DESC[role]);
  await ensureGroup(client, pool, "vertical_platform", "Platform — NexCort iQ internal admin accounts");

  const desired = desiredAttrs(email, role);

  let existing: UserType | undefined;
  try {
    const got = await client.send(new AdminGetUserCommand({ UserPoolId: pool, Username: email }));
    existing = got as unknown as UserType;
  } catch (e) {
    if ((e as { name?: string }).name !== "UserNotFoundException") throw e;
  }

  if (!existing) {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: pool,
        Username: email,
        UserAttributes: desired,
        TemporaryPassword: password,
        MessageAction: "SUPPRESS",
        DesiredDeliveryMediums: [],
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({ UserPoolId: pool, Username: email, Password: password, Permanent: true }),
    );
    log(`Created ${email} (${role}) — permanent password set from env, not logged`);
  } else {
    if (attrsDiffer(existing, desired)) {
      await client.send(new AdminUpdateUserAttributesCommand({ UserPoolId: pool, Username: email, UserAttributes: desired }));
      log(`Updated attributes for ${email}`);
    } else {
      log(`${email} attributes already match — no update`);
    }
    if (reset) {
      await client.send(
        new AdminSetUserPasswordCommand({ UserPoolId: pool, Username: email, Password: password, Permanent: true }),
      );
      log(`Password reset for ${email} (not logged)`);
    } else {
      log(`${email} password unchanged (set RESET_RC_STAFF_PASSWORD=true to force)`);
    }
  }

  if (!(await isInGroup(client, pool, email, ROLE_GROUP[role]))) {
    await client.send(new AdminAddUserToGroupCommand({ UserPoolId: pool, Username: email, GroupName: ROLE_GROUP[role] }));
    log(`Added ${email} → group ${ROLE_GROUP[role]}`);
  }
  if (!(await isInGroup(client, pool, email, "vertical_platform"))) {
    await client.send(new AdminAddUserToGroupCommand({ UserPoolId: pool, Username: email, GroupName: "vertical_platform" }));
    log(`Added ${email} → group vertical_platform`);
  }
}

async function main(): Promise<void> {
  const region = requireEnv("AWS_REGION");
  const pool = requireEnv("COGNITO_USER_POOL_ID");
  const password =
    optionalEnv("RC_STAFF_TEMP_PASSWORD") ||
    optionalEnv("RAPID_CORTEX_RC_ADMIN_TEMP_PASSWORD") ||
    optionalEnv("RAPID_CORTEX_SUPERADMIN_TEMP_PASSWORD");
  if (!password) {
    throw new Error(
      "Set RC_STAFF_TEMP_PASSWORD (or legacy RAPID_CORTEX_RC_ADMIN_TEMP_PASSWORD). Value is never logged.",
    );
  }
  if (!isTempPasswordValid(password)) {
    throw new Error("RC_STAFF_TEMP_PASSWORD does not meet pool policy (12+ chars, upper, lower, number, symbol). Not logged.");
  }
  const reset = process.env.RESET_RC_STAFF_PASSWORD === "true";

  const principals: Array<{ email: string; role: RcRole }> = [];

  const superEmail =
    optionalEnv("RC_SUPERADMIN_EMAIL") ||
    optionalEnv("RAPID_CORTEX_RC_ADMIN_EMAIL") ||
    optionalEnv("RAPID_CORTEX_SUPERADMIN_EMAIL") ||
    "Support@appsondemand.net";
  principals.push({ email: superEmail, role: "rcsuperadmin" });

  const adminEmail = optionalEnv("RC_ADMIN_EMAIL");
  if (adminEmail) principals.push({ email: adminEmail, role: "rcadmin" });

  const itEmail = optionalEnv("RC_ITADMIN_EMAIL");
  if (itEmail) principals.push({ email: itEmail, role: "rcitadmin" });

  if (principals.length === 0) {
    throw new Error("No RC staff emails configured. Set at least RC_SUPERADMIN_EMAIL.");
  }

  const client = new CognitoIdentityProviderClient({ region });

  for (const { email, role } of principals) {
    await provisionPrincipal(client, pool, email, role, password, reset);
  }

  log("Done.");
  if (!optionalEnv("RC_ADMIN_EMAIL")) {
    log("NOTE: RC_ADMIN_EMAIL not set — rcadmin principal skipped. Set it to provision the RC admin seat.");
  }
  if (!optionalEnv("RC_ITADMIN_EMAIL")) {
    log("NOTE: RC_ITADMIN_EMAIL not set — rcitadmin principal skipped. Set it to provision the RC IT admin seat.");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(LOG, "Failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

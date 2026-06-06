/**
 * Secure one-shot (or re-run) seed: create or update the first Rapid Cortex RC Super Admin principal in Cognito.
 *
 * Security: never log passwords. Prefer `RAPID_CORTEX_RC_ADMIN_TEMP_PASSWORD` (falls back to legacy
 * `RAPID_CORTEX_SUPERADMIN_TEMP_PASSWORD`).
 *
 * Product: `custom:role=rcsuperadmin` and sentinel `custom:agencyId=__platform__`
 * (`packages/shared` → `PLATFORM_AGENCY_ID`).
 */
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";

/** Must match `PLATFORM_AGENCY_ID` in `packages/shared/src/tenancy/constants.ts`. */
const PLATFORM_AGENCY_ID = "__platform__" as const;

const RC_SUPERADMIN_ROLE = "rcsuperadmin" as const;
/** Must match Cognito pool group configured in IaC (`GroupName: rcsuperadmin`). */
const RC_SUPERADMIN_GROUP = "rcsuperadmin" as const;

/** Legacy pool groups still honored for idempotent membership checks. */
const LEGACY_RC_ADMIN_GROUP = "rc_admin" as const;
const LEGACY_SUPERADMIN_GROUP = "platform_superadmin" as const;

const DEFAULT_EMAIL = "Support@appsondemand.net" as const;
const DEFAULT_STATUS = "active" as const;

const LOG = "[create-rc-admin]";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function requireRcAdminTempPassword(): string {
  const v =
    process.env.RAPID_CORTEX_RC_ADMIN_TEMP_PASSWORD?.trim() ||
    process.env.RAPID_CORTEX_SUPERADMIN_TEMP_PASSWORD?.trim();
  if (!v) {
    throw new Error(
      "Set RAPID_CORTEX_RC_ADMIN_TEMP_PASSWORD (or legacy RAPID_CORTEX_SUPERADMIN_TEMP_PASSWORD). Values are never logged.",
    );
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

function baseUserAttributes(
  email: string,
  status: string,
): Array<{ Name: string; Value: string }> {
  return [
    { Name: "email", Value: email },
    { Name: "email_verified", Value: "true" },
    { Name: "custom:role", Value: RC_SUPERADMIN_ROLE },
    { Name: "custom:agencyId", Value: PLATFORM_AGENCY_ID },
    { Name: "custom:status", Value: status },
  ];
}

function mapAttributes(
  list: Array<{ Name?: string; Value?: string }> | undefined,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of list ?? []) {
    if (a.Name && a.Value != null) m.set(a.Name, a.Value);
  }
  return m;
}

function attributesDiffer(
  current: UserType | undefined,
  desired: Array<{ Name: string; Value: string }>,
): boolean {
  const m = mapAttributes(current?.Attributes);
  for (const d of desired) {
    if (m.get(d.Name) !== d.Value) return true;
  }
  return false;
}

async function hasRcsuperadminGroupMembership(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  username: string,
): Promise<boolean> {
  const res = await client.send(
    new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: username }),
  );
  return (res.Groups ?? []).some(
    (g) =>
      g.GroupName === RC_SUPERADMIN_GROUP ||
      g.GroupName === LEGACY_RC_ADMIN_GROUP ||
      g.GroupName === LEGACY_SUPERADMIN_GROUP,
  );
}

async function main() {
  const region = requireEnv("AWS_REGION");
  const userPoolId = requireEnv("COGNITO_USER_POOL_ID");
  const email =
    process.env.RAPID_CORTEX_RC_ADMIN_EMAIL?.trim() ||
    process.env.RAPID_CORTEX_SUPERADMIN_EMAIL?.trim() ||
    DEFAULT_EMAIL;
  const status =
    process.env.RAPID_CORTEX_RC_ADMIN_STATUS?.trim() ||
    process.env.RAPID_CORTEX_SUPERADMIN_STATUS?.trim() ||
    DEFAULT_STATUS;
  const resetPassword =
    process.env.RESET_RC_ADMIN_PASSWORD === "true" || process.env.RESET_SUPERADMIN_PASSWORD === "true";

  const client = new CognitoIdentityProviderClient({ region });
  const desiredAttrs = baseUserAttributes(email, status);

  let existing: UserType | undefined;
  try {
    const got = await client.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }),
    );
    existing = got;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name !== "UserNotFoundException") throw e;
  }

  const tempPasswordHint =
    "RC Super Admin temp password env does not meet pool password policy (12+ chars, upper, lower, number, symbol). Password is never logged.";

  if (!existing) {
    const tempPassword = requireRcAdminTempPassword();
    if (!isTempPasswordValidForPoolPolicy(tempPassword)) {
      throw new Error(tempPasswordHint);
    }

    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: desiredAttrs,
        TemporaryPassword: tempPassword,
        MessageAction: "SUPPRESS",
        DesiredDeliveryMediums: [],
      }),
    );
    // eslint-disable-next-line no-console
    console.log(
      `${LOG} Created user ${email} (FORCE_CHANGE_PASSWORD). Temporary password from env; not logged. TOTP/MFA may be required on first sign-in if enabled on the pool.`,
    );
  } else {
    if (attributesDiffer(existing, desiredAttrs)) {
      await client.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: email,
          UserAttributes: desiredAttrs,
        }),
      );
      // eslint-disable-next-line no-console
      console.log(`${LOG} Updated attributes for existing user ${email}.`);
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `${LOG} User ${email} already exists with expected attributes. No attribute changes.`,
      );
    }

    if (resetPassword) {
      const tempPassword = requireRcAdminTempPassword();
      if (!isTempPasswordValidForPoolPolicy(tempPassword)) {
        throw new Error(`${tempPasswordHint} Not resetting.`);
      }
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: email,
          Password: tempPassword,
          Permanent: false,
        }),
      );
      // eslint-disable-next-line no-console
      console.log(
        `${LOG} Password reset flag set: new temporary password from env applied (not logged). User must change password on next sign-in.`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `${LOG} Not changing password (set RESET_RC_ADMIN_PASSWORD=true or legacy RESET_SUPERADMIN_PASSWORD=true).`,
      );
    }
  }

  if (!(await hasRcsuperadminGroupMembership(client, userPoolId, email))) {
    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: RC_SUPERADMIN_GROUP,
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`${LOG} Added ${email} to group ${RC_SUPERADMIN_GROUP}.`);
  } else {
    const res = await client.send(
      new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: email }),
    );
    const names = new Set((res.Groups ?? []).map((g) => g.GroupName));
    if (!names.has(RC_SUPERADMIN_GROUP) && (names.has(LEGACY_RC_ADMIN_GROUP) || names.has(LEGACY_SUPERADMIN_GROUP))) {
      await client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: email,
          GroupName: RC_SUPERADMIN_GROUP,
        }),
      );
      // eslint-disable-next-line no-console
      console.log(
        `${LOG} User had legacy group membership; added ${RC_SUPERADMIN_GROUP} as well.`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`${LOG} User ${email} already has RC Super Admin (or legacy) group membership.`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`${LOG} Done.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(LOG, "Failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

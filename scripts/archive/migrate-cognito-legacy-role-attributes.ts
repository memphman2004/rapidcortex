/**
 * Idempotent Cognito migration: normalize `custom:role` legacy values (`platform_superadmin`, `superadmin`, `rc_admin`)
 * → `rcsuperadmin`.
 *
 * Default: dry-run (counts only — no emails, passwords, or tokens logged).
 *
 * Usage:
 *   AWS_REGION=us-east-1 COGNITO_USER_POOL_ID=us-east-1_xxxxx npx tsx scripts/migrate-cognito-legacy-role-attributes.ts
 *   ... --apply
 */
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminUpdateUserAttributesCommand,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";

const LEGACY = new Set(["platform_superadmin", "superadmin", "rc_admin"]);
const TARGET = "rcsuperadmin";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function attr(attrs: AttributeType[] | undefined, name: string): string {
  return String(attrs?.find((a) => a.Name === name)?.Value ?? "").trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const region = requireEnv("AWS_REGION");
  const userPoolId = requireEnv("COGNITO_USER_POOL_ID");
  const client = new CognitoIdentityProviderClient({ region });

  let scanned = 0;
  let legacyCount = 0;
  let updatedCount = 0;
  let token: string | undefined;

  do {
    const out = await client.send(
      new ListUsersCommand({ UserPoolId: userPoolId, Limit: 60, PaginationToken: token }),
    );
    token = out.PaginationToken;

    for (const u of out.Users ?? []) {
      scanned++;
      const username = u.Username ?? "";
      const role = attr(u.Attributes, "custom:role");
      if (!LEGACY.has(role)) continue;
      legacyCount++;
      if (apply && username) {
        await client.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: userPoolId,
            Username: username,
            UserAttributes: [{ Name: "custom:role", Value: TARGET }],
          }),
        );
        updatedCount++;
      }
    }
  } while (token);

  const mode = apply ? "apply" : "dry-run";
  // eslint-disable-next-line no-console
  console.log(
    `[migrate-cognito-legacy-role-attributes:${mode}] scanned=${scanned} legacy_roles=${legacyCount} updated=${updatedCount}`,
  );
  if (!apply && legacyCount > 0) {
    // eslint-disable-next-line no-console
    console.log('[migrate-cognito-legacy-role-attributes] Re-run with --apply to write "rcsuperadmin" to matching users.');
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[migrate-cognito-legacy-role-attributes] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

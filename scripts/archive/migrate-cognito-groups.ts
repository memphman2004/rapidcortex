#!/usr/bin/env npx tsx
/**
 * Cognito group migration — creates canonical role groups, moves members, deletes legacy groups.
 * Also migrates **`custom:role`** user attributes from legacy underscore / synonym values to canonical tokens.
 *
 * Usage:
 *   npx tsx scripts/migrate-cognito-groups.ts --user-pool-id us-east-1_xxxx --env dev [--execute] [--skip-staff-remap-review]
 *
 * Dry-run by default; pass `--execute` to perform writes.
 * Staff users are moved to the `auditor` group before deleting `staff` (requires `--execute` and human review).
 */
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  CreateGroupCommand,
  DeleteGroupCommand,
  ListGroupsCommand,
  ListUsersCommand,
  ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

type EnvName = "dev" | "staging" | "prod";

const GROUP_RENAMES: { from: string; to: string; description: string }[] = [
  { from: "rc_admin", to: "rcsuperadmin", description: "Rapid Cortex platform super-administrator" },
  { from: "admin", to: "agencyadmin", description: "Agency administrator" },
  { from: "supervisor", to: "commsupervisor", description: "Communications supervisor" },
  { from: "it_admin", to: "agencyit", description: "Agency IT administrator" },
  { from: "readonly_auditor", to: "auditor", description: "Read-only auditor" },
  { from: "platform_superadmin", to: "rcsuperadmin", description: "Rapid Cortex platform super-administrator (legacy)" },
];

const NEW_GROUPS: { name: string; description: string }[] = [
  { name: "rcadmin", description: "Rapid Cortex business operations (billing, onboarding, notices)" },
  { name: "rcitadmin", description: "Rapid Cortex technical support (users, integrations, diagnostics)" },
];

/** Legacy `custom:role` attribute values → canonical Rapid Cortex role tokens (pool attribute migration). */
const CUSTOM_ROLE_ATTR_LEGACY_TO_CANONICAL: Record<string, string> = {
  rc_admin: "rcadmin",
  platform_superadmin: "rcsuperadmin",
  it_admin: "agencyit",
  readonly_auditor: "auditor",
  supervisor: "commsupervisor",
  staff: "auditor",
  admin: "agencyadmin",
  superadmin: "rcsuperadmin",
};

function parseArgs(argv: string[]) {
  let env: EnvName | null = null;
  let pool: string | null = null;
  let execute = false;
  let skipStaffReview = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--execute") execute = true;
    else if (a === "--skip-staff-remap-review") skipStaffReview = true;
    else if (a === "--env" && argv[i + 1]) env = argv[++i] as EnvName;
    else if (a === "--user-pool-id" && argv[i + 1]) pool = argv[++i] ?? null;
  }
  return { env, pool, execute, skipStaffReview };
}

async function listAllGroupNames(client: CognitoIdentityProviderClient, userPoolId: string): Promise<Set<string>> {
  const names = new Set<string>();
  let token: string | undefined;
  do {
    const out = await client.send(new ListGroupsCommand({ UserPoolId: userPoolId, NextToken: token }));
    for (const g of out.Groups ?? []) {
      if (g.GroupName) names.add(g.GroupName);
    }
    token = out.NextToken;
  } while (token);
  return names;
}

async function usersInGroup(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  group: string,
): Promise<string[]> {
  const users: string[] = [];
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListUsersInGroupCommand({ UserPoolId: userPoolId, GroupName: group, NextToken: token }),
    );
    for (const u of out.Users ?? []) {
      if (u.Username) users.push(u.Username);
    }
    token = out.NextToken;
  } while (token);
  return users;
}

async function moveGroupMembers(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  from: string,
  to: string,
  execute: boolean,
): Promise<number> {
  const members = await usersInGroup(client, userPoolId, from);
  let moved = 0;
  for (const username of members) {
    if (!execute) {
      moved++;
      continue;
    }
    await client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: to }));
    await client.send(
      new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: from }),
    );
    moved++;
  }
  return moved;
}

function readAttr(attrs: { Name?: string; Value?: string }[] | undefined, name: string): string | undefined {
  const v = attrs?.find((a) => a.Name === name)?.Value?.trim();
  return v || undefined;
}

async function migrateCustomRoleAttributes(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  execute: boolean,
) {
  let examined = 0;
  let pending = 0;
  let updated = 0;
  let token: string | undefined;
  do {
    const out = await client.send(new ListUsersCommand({ UserPoolId: userPoolId, PaginationToken: token }));
    for (const u of out.Users ?? []) {
      const username = u.Username;
      if (!username) continue;
      examined++;
      const oldRole = readAttr(u.Attributes, "custom:role");
      if (!oldRole) continue;
      const newRole = CUSTOM_ROLE_ATTR_LEGACY_TO_CANONICAL[oldRole];
      if (!newRole || newRole === oldRole) continue;
      pending++;
      if (!execute) {
        console.log(`[dry-run] custom:role ${username}: ${oldRole} → ${newRole}`);
        continue;
      }
      await client.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: username,
          UserAttributes: [{ Name: "custom:role", Value: newRole }],
        }),
      );
      console.log(`updated custom:role ${username}: ${oldRole} → ${newRole}`);
      updated++;
    }
    token = out.PaginationToken;
  } while (token);

  console.log(
    JSON.stringify(
      {
        customRoleAttributeMigration: {
          usersExamined: examined,
          changesPendingOrApplied: execute ? updated : pending,
          execute,
        },
      },
      null,
      2,
    ),
  );
}

async function ensureGroup(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  name: string,
  description: string,
  existing: Set<string>,
  execute: boolean,
) {
  if (existing.has(name)) return;
  if (!execute) {
    console.log(`[dry-run] would create group ${name}`);
    return;
  }
  await client.send(
    new CreateGroupCommand({
      UserPoolId: userPoolId,
      GroupName: name,
      Description: description,
    }),
  );
  existing.add(name);
  console.log(`created group ${name}`);
}

async function main() {
  const { env, pool, execute, skipStaffReview } = parseArgs(process.argv);
  if (!env || !["dev", "staging", "prod"].includes(env)) {
    console.error("FATAL: pass --env dev|staging|prod");
    process.exit(1);
  }
  if (!pool?.trim()) {
    console.error("FATAL: pass --user-pool-id");
    process.exit(1);
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const client = new CognitoIdentityProviderClient({ region });
  const userPoolId = pool.trim();

  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", env, userPoolId, region }, null, 2));

  const existing = await listAllGroupNames(client, userPoolId);

  for (const g of NEW_GROUPS) {
    await ensureGroup(client, userPoolId, g.name, g.description, existing, execute);
  }

  for (const { from, to, description } of GROUP_RENAMES) {
    if (!existing.has(from)) continue;
    await ensureGroup(client, userPoolId, to, description, existing, execute);
    const moved = await moveGroupMembers(client, userPoolId, from, to, execute);
    console.log(JSON.stringify({ rename: { from, to }, membersMoved: moved, dryRun: !execute }, null, 2));
    if (execute && moved >= 0) {
      try {
        await client.send(new DeleteGroupCommand({ UserPoolId: userPoolId, GroupName: from }));
        console.log(`deleted legacy group ${from}`);
      } catch (e) {
        console.warn(`could not delete group ${from}:`, e);
      }
    }
  }

  await migrateCustomRoleAttributes(client, userPoolId, execute);

  if (existing.has("staff")) {
    if (execute && !skipStaffReview) {
      console.error(
        "Refusing to delete staff group without --skip-staff-remap-review (confirm humans reviewed mapped users).",
      );
      process.exit(2);
    }
    await ensureGroup(client, userPoolId, "auditor", "Read-only auditor", existing, execute);
    const movedStaff = await moveGroupMembers(client, userPoolId, "staff", "auditor", execute);
    console.log(JSON.stringify({ staffToAuditor: movedStaff, dryRun: !execute }, null, 2));
    if (execute && skipStaffReview) {
      await client.send(new DeleteGroupCommand({ UserPoolId: userPoolId, GroupName: "staff" }));
      console.log("deleted legacy group staff");
    }
  }

  if (!execute) console.log("Dry-run complete. Re-run with --execute after review.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env npx tsx
/**
 * DynamoDB role migration — maps legacy `custom:role` / profile `role` values to canonical RBAC tokens.
 *
 * Usage:
 *   npx tsx scripts/migrate-roles.ts --env dev [--execute]
 *   USERS_TABLE_NAME=my-table AWS_REGION=us-east-1 npx tsx scripts/migrate-roles.ts --env staging
 *
 * Dry-run by default; pass `--execute` to write updates/deletes.
 * Requires `--env dev|staging|prod`.
 *
 * Set `USERS_TABLE_NAME` explicitly (per environment). The script scans the entire table — run off-peak.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

type EnvName = "dev" | "staging" | "prod";

const LEGACY_MAP: Record<string, string | "__DELETE__"> = {
  platform_superadmin: "rcsuperadmin",
  superadmin: "rcsuperadmin",
  rc_admin: "rcsuperadmin",
  admin: "agencyadmin",
  it_admin: "agencyit",
  supervisor: "commsupervisor",
  readonly_auditor: "auditor",
  staff: "__DELETE__",
};

function parseArgs(argv: string[]) {
  let env: EnvName | null = null;
  let execute = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--execute") execute = true;
    else if (a === "--env" && argv[i + 1]) {
      env = argv[++i] as EnvName;
    }
  }
  return { env, execute };
}

function mapRole(raw: unknown): { next?: string; deleteRow: boolean } {
  if (raw == null) return { deleteRow: false };
  const t = String(raw).trim();
  if (!t) return { deleteRow: false };
  const m = LEGACY_MAP[t];
  if (m === "__DELETE__") return { deleteRow: true };
  if (m) return { next: m, deleteRow: false };
  return { deleteRow: false };
}

async function main() {
  const { env, execute } = parseArgs(process.argv);
  if (!env || !["dev", "staging", "prod"].includes(env)) {
    console.error("FATAL: pass --env dev|staging|prod");
    process.exit(1);
  }

  const table =
    process.env.USERS_TABLE_NAME?.trim() ||
    process.env[`USERS_TABLE_NAME_${env.toUpperCase()}`]?.trim() ||
    "";
  if (!table) {
    console.error("FATAL: set USERS_TABLE_NAME (or USERS_TABLE_NAME_<ENV>) for this migration.");
    process.exit(1);
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const roleAttr = process.env.RAPID_CORTEX_USER_ROLE_ATTR?.trim() || "role";
  const pkAttr = process.env.RAPID_CORTEX_USER_PK_ATTR?.trim() || "agencyId";
  const skAttr = process.env.RAPID_CORTEX_USER_SK_ATTR?.trim() || "userId";

  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });

  let scanned = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  let startKey: Record<string, unknown> | undefined;

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        env,
        table,
        region,
        roleAttr,
        pkAttr,
        skAttr,
      },
      null,
      2,
    ),
  );

  do {
    const out = await doc.send(
      new ScanCommand({
        TableName: table,
        ExclusiveStartKey: startKey,
      }),
    );
    const items = out.Items ?? [];
    for (const item of items) {
      scanned++;
      const rawRole = item[roleAttr];
      const { next, deleteRow } = mapRole(rawRole);
      if (deleteRow) {
        if (!execute) {
          deleted++;
          continue;
        }
        const pk = item[pkAttr];
        const sk = item[skAttr];
        if (pk == null || sk == null) {
          skipped++;
          continue;
        }
        await doc.send(
          new DeleteCommand({
            TableName: table,
            Key: { [pkAttr]: pk, [skAttr]: sk } as Record<string, unknown>,
          }),
        );
        deleted++;
        continue;
      }
      if (!next || next === rawRole) {
        skipped++;
        continue;
      }
      if (!execute) {
        updated++;
        continue;
      }
      const pk = item[pkAttr];
      const sk = item[skAttr];
      if (pk == null || sk == null) {
        skipped++;
        continue;
      }
      await doc.send(
        new UpdateCommand({
          TableName: table,
          Key: { [pkAttr]: pk, [skAttr]: sk } as Record<string, unknown>,
          UpdateExpression: `SET #r = :r`,
          ExpressionAttributeNames: { "#r": roleAttr },
          ExpressionAttributeValues: { ":r": next },
        }),
      );
      updated++;
    }
    startKey = out.LastEvaluatedKey;
  } while (startKey);

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          summary: "dry-run (no writes)",
          scanned,
          wouldUpdate: updated,
          wouldDelete: deleted,
          skipped,
        },
        null,
        2,
      ),
    );
    console.log("Re-run with --execute after review.");
    return;
  }

  console.log(JSON.stringify({ summary: "execute", scanned, updated, deleted, skipped }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

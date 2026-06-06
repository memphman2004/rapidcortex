import { createHash, randomBytes } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { CAMPUS_KEYS } from "./campus-types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function campusConfigTable(): string {
  const t = process.env.CAMPUS_CONFIG_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CONFIG_TABLE not set");
  return t;
}

function generateRawToken(): string {
  return randomBytes(16).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function createAnonToken(campusCode: string, incidentId: string): Promise<string> {
  const rawToken = generateRawToken();
  const hashed = hashToken(rawToken);
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  await ddb.send(
    new PutCommand({
      TableName: campusConfigTable(),
      Item: {
        pk: CAMPUS_KEYS.anonTokenPk(hashed),
        sk: CAMPUS_KEYS.anonTokenSk(),
        incidentId,
        campusCode,
        createdAt: now,
        ttl,
      },
    }),
  );

  return `${campusCode}-${new Date().getFullYear()}-${rawToken.slice(0, 8)}`;
}

export async function lookupAnonToken(
  displayToken: string,
): Promise<{ incidentId: string; campusCode: string } | null> {
  const parts = displayToken.split("-");
  if (parts.length < 3) return null;
  const short = parts.slice(2).join("-");
  if (!short) return null;

  // Phase 3.5: replace short-token fallback with full token storage/lookup design.
  const candidateHash = hashToken(short);
  const result = await ddb.send(
    new GetCommand({
      TableName: campusConfigTable(),
      Key: {
        pk: CAMPUS_KEYS.anonTokenPk(candidateHash),
        sk: CAMPUS_KEYS.anonTokenSk(),
      },
    }),
  );
  const item = result.Item as { incidentId?: string; campusCode?: string } | undefined;
  if (!item?.incidentId || !item?.campusCode) return null;
  return { incidentId: item.incidentId, campusCode: item.campusCode };
}

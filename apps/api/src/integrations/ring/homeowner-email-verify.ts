import { randomBytes } from "node:crypto";
import {
  AdminEnableUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { env } from "../../lib/env.js";
import { ddb } from "../../repositories/baseRepository.js";
import { sesConfigurationSetFields } from "../../lib/ses/sesConfigurationSet.js";
import { RING_ACCOUNT_LINK_URL, RING_REDIRECT_URI } from "../../lib/ring-integration.js";

export const HOMEOWNER_EMAIL_VERIFY_PK = "__ring_homeowner_email_verify__";
export const HOMEOWNER_EMAIL_VERIFY_ITEM_TYPE = "homeowner_email_verify";
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function pendingTable(): string {
  const t =
    process.env.HOMEOWNER_PENDING_TABLE?.trim() ||
    env.ringRequestsTable?.trim() ||
    process.env.RING_TABLE_REQUESTS?.trim() ||
    "";
  if (!t) throw new Error("HOMEOWNER_PENDING_TABLE_NOT_CONFIGURED");
  return t;
}

function publicApiBase(): string {
  const explicit =
    process.env.RING_PUBLIC_API_BASE_URL?.trim() || process.env.RING_PUBLIC_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  try {
    return new URL(RING_REDIRECT_URI).origin;
  } catch {
    return "https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com";
  }
}

export function homeownerVerifyUrl(token: string): string {
  return `${publicApiBase()}/api/public/ring/homeowner/verify?token=${encodeURIComponent(token)}`;
}

export async function sendHomeownerVerificationEmail(email: string, verificationToken: string): Promise<void> {
  if (env.sesMock) {
    console.info(JSON.stringify({ msg: "homeowner_verify_email_mock", email }));
    return;
  }
  const fromEmail =
    env.sesFromEmail || env.contactFromEmail || process.env.CONTACT_FROM_EMAIL?.trim() || "support@rapidcortex.us";
  const link = homeownerVerifyUrl(verificationToken);
  const ses = new SESClient({ region: env.region || process.env.AWS_REGION || "us-east-1" });
  await ses.send(
    new SendEmailCommand({
      ...sesConfigurationSetFields(),
      Source: fromEmail,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: "Verify your Rapid Cortex device-owner account" },
        Body: {
          Text: {
            Data: `Confirm this email to finish setting up your Rapid Cortex device-owner account.\n\n${link}\n\nThis link expires in 24 hours.`,
          },
        },
      },
    }),
  );
}

export async function storeHomeownerVerificationToken(input: {
  token: string;
  email: string;
  cognitoUsername: string;
  agencyId: string;
}): Promise<void> {
  const now = Date.now();
  const ttl = Math.floor((now + VERIFY_TTL_MS) / 1000);
  await ddb.send(
    new PutCommand({
      TableName: pendingTable(),
      Item: {
        agencyIncidentKey: HOMEOWNER_EMAIL_VERIFY_PK,
        requestId: input.token,
        itemType: HOMEOWNER_EMAIL_VERIFY_ITEM_TYPE,
        token: input.token,
        email: input.email,
        cognitoUsername: input.cognitoUsername,
        agencyId: input.agencyId,
        createdAt: now,
        expiresAt: now + VERIFY_TTL_MS,
        type: "EMAIL_VERIFICATION",
        ttl,
      },
    }),
  );
}

export async function consumeHomeownerVerificationToken(
  token: string,
): Promise<{ email: string; cognitoUsername: string; agencyId: string } | null> {
  const plain = token.trim();
  if (plain.length < 16) return null;
  const table = pendingTable();
  const out = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { agencyIncidentKey: HOMEOWNER_EMAIL_VERIFY_PK, requestId: plain },
    }),
  );
  const item = out.Item;
  if (!item || item.itemType !== HOMEOWNER_EMAIL_VERIFY_ITEM_TYPE) return null;
  const expiresAt = Number(item.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const email = String(item.email ?? "").trim().toLowerCase();
  const cognitoUsername = String(item.cognitoUsername ?? "").trim();
  const agencyId = String(item.agencyId ?? "").trim();
  if (!email || !cognitoUsername || !agencyId) return null;

  await ddb.send(
    new DeleteCommand({
      TableName: table,
      Key: { agencyIncidentKey: HOMEOWNER_EMAIL_VERIFY_PK, requestId: plain },
      ConditionExpression: "agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );

  return { email, cognitoUsername, agencyId };
}

export async function enableVerifiedHomeowner(cognitoUsername: string): Promise<void> {
  const poolId = env.cognitoUserPoolId;
  if (!poolId) throw new Error("COGNITO_NOT_CONFIGURED");
  const cip = new CognitoIdentityProviderClient({});
  await cip.send(new AdminEnableUserCommand({ UserPoolId: poolId, Username: cognitoUsername }));
  await cip.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: poolId,
      Username: cognitoUsername,
      UserAttributes: [{ Name: "email_verified", Value: "true" }],
    }),
  );
}

export function newHomeownerVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

/** Kept so call sites can mention RING_ACCOUNT_LINK_URL in verify success copy. */
export function homeownerSignInUrl(): string {
  return RING_ACCOUNT_LINK_URL.replace(/\/link\/?$/, "/start");
}

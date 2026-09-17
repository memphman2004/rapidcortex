/**
 * Microsoft Graph mail for RC Sales Automation campaign send.
 * Delegated OAuth (Mail.Send + offline_access) so approved sequences leave the
 * connected Outlook mailbox and land in Sent Items. Mock path when
 * OUTLOOK_GRAPH_MOCK=1 or the Azure app is not configured.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";
import {
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
} from "../webhookSecretEncryption.js";

/** Platform Outlook mailbox for campaign send. Tokens are encrypted at rest. */
export type SalesOutlookConnection = {
  agencyId: "platform";
  mailbox: string;
  mock: boolean;
  refreshTokenEnc?: string;
  accessTokenEnc?: string;
  accessTokenExpiresAt?: string;
  connectedBy: string;
  connectedAt: string;
  updatedAt: string;
};

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = "openid profile email offline_access User.Read Mail.Send";
export const DEFAULT_SALES_OUTLOOK_MAILBOX = "hello@rapidcortex.us";

export function salesOutlookMailbox(): string {
  return (env.outlookSalesMailbox || DEFAULT_SALES_OUTLOOK_MAILBOX).trim().toLowerCase();
}

export function isAllowedSalesMailbox(mailbox: string): boolean {
  return mailbox.trim().toLowerCase() === salesOutlookMailbox();
}

export function isOutlookGraphMock(): boolean {
  return env.outlookGraphMock;
}

export function isOutlookOAuthConfigured(): boolean {
  return Boolean(env.outlookOAuthClientId);
}

export async function resolveOutlookClientSecret(): Promise<string> {
  return resolvePlainOrSecretArn(env.outlookOAuthClientSecret, env.outlookOAuthClientSecretArn, {
    preferredField: "clientSecret",
  });
}

function authorizeBase(): string {
  const tenant = encodeURIComponent(env.outlookOAuthTenant || "common");
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
}

export function signOutlookOAuthState(userId: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, exp: Date.now() + 15 * 60_000 }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOutlookOAuthState(
  state: string,
  secret: string,
): { userId: string } | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: string;
      exp?: number;
    };
    if (!parsed.u || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return { userId: parsed.u };
  } catch {
    return null;
  }
}

export function buildOutlookAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.outlookOAuthClientId,
    response_type: "code",
    redirect_uri: env.outlookOAuthRedirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "login",
    login_hint: salesOutlookMailbox(),
  });
  return `${authorizeBase()}/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(`${authorizeBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Outlook token HTTP ${res.status}`);
  }
  return json;
}

async function graphMeMailbox(accessToken: string): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    mail?: string;
    userPrincipalName?: string;
  };
  const mailbox = (json.mail || json.userPrincipalName || "").trim().toLowerCase();
  if (!mailbox.includes("@")) throw new Error("Outlook mailbox not returned from Graph /me");
  return mailbox;
}

export async function exchangeOutlookAuthCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  mailbox: string;
  expiresIn: number;
}> {
  const secret = await resolveOutlookClientSecret();
  if (!secret) throw new Error("OUTLOOK_OAUTH_CLIENT_SECRET_NOT_CONFIGURED");
  const json = await tokenRequest(
    new URLSearchParams({
      client_id: env.outlookOAuthClientId,
      client_secret: secret,
      grant_type: "authorization_code",
      code,
      redirect_uri: env.outlookOAuthRedirectUri,
      scope: SCOPES,
    }),
  );
  if (!json.refresh_token) throw new Error("Outlook did not return a refresh token");
  const mailbox = await graphMeMailbox(json.access_token!);
  if (!isAllowedSalesMailbox(mailbox)) {
    throw new Error(
      `Connect Outlook as ${salesOutlookMailbox()}. Microsoft signed in as ${mailbox}.`,
    );
  }
  return {
    accessToken: json.access_token!,
    refreshToken: json.refresh_token,
    mailbox,
    expiresIn: json.expires_in ?? 3600,
  };
}

export async function refreshOutlookAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const secret = await resolveOutlookClientSecret();
  if (!secret) throw new Error("OUTLOOK_OAUTH_CLIENT_SECRET_NOT_CONFIGURED");
  const json = await tokenRequest(
    new URLSearchParams({
      client_id: env.outlookOAuthClientId,
      client_secret: secret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  );
  return {
    accessToken: json.access_token!,
    refreshToken: json.refresh_token || refreshToken,
    expiresIn: json.expires_in ?? 3600,
  };
}

export async function encryptOutlookToken(plain: string): Promise<string> {
  return encryptWebhookSigningSecret(plain);
}

export async function decryptOutlookToken(stored: string): Promise<string> {
  return decryptWebhookSigningSecret(stored);
}

export async function ensureOutlookAccessToken(
  conn: SalesOutlookConnection,
): Promise<{ accessToken: string; next?: SalesOutlookConnection }> {
  if (conn.mock || !conn.refreshTokenEnc) {
    throw new Error("Outlook connection is mock or missing refresh token");
  }
  const now = Date.now();
  if (conn.accessTokenEnc && conn.accessTokenExpiresAt) {
    const exp = Date.parse(conn.accessTokenExpiresAt);
    if (Number.isFinite(exp) && exp - 60_000 > now) {
      return { accessToken: await decryptOutlookToken(conn.accessTokenEnc) };
    }
  }
  const refreshToken = await decryptOutlookToken(conn.refreshTokenEnc);
  const refreshed = await refreshOutlookAccessToken(refreshToken);
  const next: SalesOutlookConnection = {
    ...conn,
    refreshTokenEnc: await encryptOutlookToken(refreshed.refreshToken),
    accessTokenEnc: await encryptOutlookToken(refreshed.accessToken),
    accessTokenExpiresAt: new Date(now + refreshed.expiresIn * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { accessToken: refreshed.accessToken, next };
}

export async function sendOutlookMail(input: {
  accessToken: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const from = salesOutlookMailbox();
  const payload = JSON.stringify({
    message: {
      subject: input.subject,
      body: {
        contentType: input.html ? "HTML" : "Text",
        content: input.html || input.text,
      },
      toRecipients: [{ emailAddress: { address: input.to } }],
      from: { emailAddress: { address: from, name: "Rapid Cortex" } },
      replyTo: [{ emailAddress: { address: from, name: "Rapid Cortex" } }],
    },
    saveToSentItems: true,
  });
  let lastError = "Outlook sendMail failed";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });
    if (res.ok) return;
    const errText = await res.text().catch(() => "");
    lastError = `Outlook sendMail HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`;
    if (res.status !== 429 && res.status < 500) throw new Error(lastError);
    const retryAfterRaw = res.headers.get("retry-after");
    const retryAfterSec = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : Number.NaN;
    const waitMs = Number.isFinite(retryAfterSec)
      ? Math.min(Math.max(retryAfterSec, 1), 20) * 1000
      : 1500 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  throw new Error(lastError);
}

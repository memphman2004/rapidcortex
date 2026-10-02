/**
 * Resolve Cognito email for RCS dispatcher display (avoids showing UUID usernames).
 */

import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { RcsCallEnriched } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";

const emailCache = new Map<string, string | null>();

function attr(attrs: { Name?: string; Value?: string }[] | undefined, name: string): string {
  return attrs?.find((a) => a.Name === name)?.Value?.trim() ?? "";
}

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

async function lookupCognitoEmail(userId: string): Promise<string | null> {
  if (emailCache.has(userId)) return emailCache.get(userId) ?? null;
  const pool = env.cognitoUserPoolId;
  if (!pool) {
    emailCache.set(userId, null);
    return null;
  }
  const cip = new CognitoIdentityProviderClient({ region: env.region });
  try {
    const out = await cip.send(new AdminGetUserCommand({ UserPoolId: pool, Username: userId }));
    const email = attr(out.UserAttributes, "email");
    if (email) {
      emailCache.set(userId, email);
      return email;
    }
  } catch {
    /* try sub filter */
  }
  try {
    const out = await cip.send(
      new ListUsersCommand({
        UserPoolId: pool,
        Filter: `sub = "${userId}"`,
        Limit: 1,
      }),
    );
    const email = attr(out.Users?.[0]?.Attributes, "email");
    emailCache.set(userId, email || null);
    return email || null;
  } catch {
    emailCache.set(userId, null);
    return null;
  }
}

/** Prefer stored email; otherwise resolve from Cognito when display is missing/UUID. */
export async function enrichCallsWithDispatcherEmail(
  calls: RcsCallEnriched[],
): Promise<RcsCallEnriched[]> {
  const idsNeedingLookup = new Set<string>();
  for (const call of calls) {
    const label = call.assignedDispatcherDisplayName?.trim();
    if (label && looksLikeEmail(label)) continue;
    const id = call.assignedDispatcherId?.trim();
    if (id) idsNeedingLookup.add(id);
  }
  if (idsNeedingLookup.size === 0) return calls;

  await Promise.all([...idsNeedingLookup].map((id) => lookupCognitoEmail(id)));

  return calls.map((call) => {
    const label = call.assignedDispatcherDisplayName?.trim();
    if (label && looksLikeEmail(label)) return call;
    const id = call.assignedDispatcherId?.trim();
    if (!id) return call;
    const email = emailCache.get(id);
    if (!email) return call;
    return { ...call, assignedDispatcherDisplayName: email };
  });
}

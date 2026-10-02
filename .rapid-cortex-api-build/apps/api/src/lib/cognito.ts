import {
  AddCustomAttributesCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "./env.js";

export type CognitoAgencyUser = {
  username: string;
  agencyId: string;
};

const AGENCY_VERTICAL_VALUES = new Set(["911", "campus", "venue"]);

function cognito() {
  return new CognitoIdentityProviderClient({ region: env.region });
}

export async function listAgencyUsers(agencyId: string): Promise<CognitoAgencyUser[]> {
  const poolId = env.cognitoUserPoolId;
  if (!poolId) return [];

  const users: CognitoAgencyUser[] = [];
  let paginationToken: string | undefined;

  // ListUsers Filter does not reliably support custom attributes — match agencyId locally.
  do {
    const out = await cognito().send(
      new ListUsersCommand({
        UserPoolId: poolId,
        PaginationToken: paginationToken,
        Limit: 60,
      }),
    );
    for (const user of out.Users ?? []) {
      const username = user.Username?.trim();
      if (!username) continue;
      const attrs = Object.fromEntries(
        (user.Attributes ?? []).map((a) => [a.Name ?? "", a.Value ?? ""]),
      );
      if (attrs["custom:agencyId"] !== agencyId) continue;
      users.push({ username, agencyId });
    }
    paginationToken = out.PaginationToken;
  } while (paginationToken);

  return users;
}

async function ensureAgencyVerticalAttribute(poolId: string): Promise<void> {
  try {
    await cognito().send(
      new AddCustomAttributesCommand({
        UserPoolId: poolId,
        CustomAttributes: [
          {
            Name: "agencyVertical",
            AttributeDataType: "String",
            Mutable: true,
            StringAttributeConstraints: { MinLength: "1", MaxLength: "32" },
          },
        ],
      }),
    );
  } catch (err) {
    const name = (err as { name?: string }).name ?? "";
    if (name === "InvalidParameterException") return;
    console.error("ensureAgencyVerticalAttribute", err);
  }
}

/**
 * Writes `custom:agencyVertical` on every Cognito user in the agency.
 * Used after RC ops sets the Call Assist operational profile. Failures on
 * individual users are logged and skipped so config PATCH still succeeds.
 */
export async function syncAgencyVerticalClaims(agencyId: string, vertical: string): Promise<number> {
  const poolId = env.cognitoUserPoolId;
  if (!poolId) return 0;
  const value = vertical.trim().toLowerCase();
  if (!AGENCY_VERTICAL_VALUES.has(value)) return 0;

  await ensureAgencyVerticalAttribute(poolId);
  const users = await listAgencyUsers(agencyId);
  let updated = 0;
  for (const user of users) {
    try {
      await cognito().send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: poolId,
          Username: user.username,
          UserAttributes: [{ Name: "custom:agencyVertical", Value: value }],
        }),
      );
      updated += 1;
    } catch (err) {
      console.error("syncAgencyVerticalClaims", user.username, err);
    }
  }
  return updated;
}

export async function syncAgencyAddonClaims(agencyId: string, addons: string[]): Promise<number> {
  const poolId = env.cognitoUserPoolId;
  if (!poolId) return 0;
  const users = await listAgencyUsers(agencyId);
  if (users.length === 0) return 0;
  const addonCsv = addons.join(",");

  for (const user of users) {
    await cognito().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: poolId,
        Username: user.username,
        UserAttributes: [{ Name: "custom:addons", Value: addonCsv }],
      }),
    );
  }
  return users.length;
}

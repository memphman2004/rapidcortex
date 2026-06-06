import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "./env.js";

export type CognitoAgencyUser = {
  username: string;
  agencyId: string;
};

function cognito() {
  return new CognitoIdentityProviderClient({ region: env.region });
}

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function listAgencyUsers(agencyId: string): Promise<CognitoAgencyUser[]> {
  const poolId = env.cognitoUserPoolId;
  if (!poolId) return [];

  const users: CognitoAgencyUser[] = [];
  let paginationToken: string | undefined;
  const filter = `custom:agencyId = "${escapeFilterValue(agencyId)}"`;

  do {
    const out = await cognito().send(
      new ListUsersCommand({
        UserPoolId: poolId,
        Filter: filter,
        PaginationToken: paginationToken,
        Limit: 60,
      }),
    );
    for (const user of out.Users ?? []) {
      const username = user.Username?.trim();
      if (!username) continue;
      users.push({ username, agencyId });
    }
    paginationToken = out.PaginationToken;
  } while (paginationToken);

  return users;
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


import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { cognitoVerticalGroupFromUser } from "rapid-cortex-shared";
import { env } from "./env.js";

/**
 * Best-effort vertical origin group assignment. Does not throw: user create/sign-up
 * must succeed even if the group is missing or IAM is not yet deployed.
 */
export async function assignCognitoVerticalGroup(input: {
  username: string;
  agencyId: string;
  role: string;
  email?: string;
}): Promise<void> {
  const poolId = env.cognitoUserPoolId;
  if (!poolId) return;
  const group = cognitoVerticalGroupFromUser(input);
  if (!group) return;
  try {
    await new CognitoIdentityProviderClient({ region: env.region }).send(
      new AdminAddUserToGroupCommand({
        UserPoolId: poolId,
        Username: input.username,
        GroupName: group,
      }),
    );
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    console.warn("assignCognitoVerticalGroup failed", { group, name });
  }
}

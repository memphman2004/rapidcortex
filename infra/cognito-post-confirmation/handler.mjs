import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

/**
 * After email-confirmed self-signup, seed tenant attributes so JWTs satisfy the API
 * (`custom:agencyId` required). Admins should replace the placeholder agency when onboarding.
 */
export const handler = async (event) => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event;
  }
  const attrs = event.request.userAttributes || {};
  if (attrs["custom:agencyId"]) {
    return event;
  }
  const agencyId = process.env.SELF_SIGNUP_DEFAULT_AGENCY_ID?.trim();
  const role = (process.env.SELF_SIGNUP_DEFAULT_ROLE || "dispatcher").trim();
  if (!agencyId) {
    console.warn(
      "SELF_SIGNUP_DEFAULT_AGENCY_ID unset; leaving custom:agencyId empty — user cannot call the API until an admin sets attributes.",
    );
    return event;
  }
  await client.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      UserAttributes: [
        { Name: "custom:agencyId", Value: agencyId },
        { Name: "custom:role", Value: role },
      ],
    }),
  );
  return event;
};

import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

const RING_REVIEWER_EMAIL = "ring-reviewer@rapidcortex.us";

/** Keep in sync with packages/shared/src/auth/cognito-vertical-group.ts */
function cognitoVerticalGroupFromUser({ agencyId, role, email }) {
  const agency = String(agencyId ?? "").trim();
  const roleLc = String(role ?? "").trim().toLowerCase();
  const emailLc = String(email ?? "").trim().toLowerCase();
  const agencyLc = agency.toLowerCase();
  if (agency === "__platform__" || roleLc.startsWith("rc")) return "vertical_platform";
  if (roleLc === "homeowner" || emailLc === RING_REVIEWER_EMAIL) return "vertical_ring";
  if (agencyLc.includes("campus") || roleLc.startsWith("campus_")) return "vertical_campus";
  if (agencyLc.includes("venue") || roleLc.startsWith("venue_")) return "vertical_venue";
  if (agencyLc.includes("transit") || roleLc.startsWith("transit_")) return "vertical_transit";
  if (
    agencyLc.includes("hospital") ||
    roleLc.startsWith("hospital_") ||
    roleLc === "hospitaladmin" ||
    roleLc === "hospitalstaff"
  ) {
    return "vertical_hospital";
  }
  if (agency) return "vertical_911";
  return null;
}

async function assignVerticalGroup({ userPoolId, username, agencyId, role, email }) {
  const group = cognitoVerticalGroupFromUser({ agencyId, role, email });
  if (!group) return;
  try {
    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: group,
      }),
    );
  } catch (err) {
    console.warn("PostConfirmation vertical group assign failed", {
      group,
      name: err?.name,
    });
  }
}

/**
 * After email-confirmed self-signup, seed tenant attributes so JWTs satisfy the API
 * (`custom:agencyId` required). Admins should replace the placeholder agency when onboarding.
 * Also assigns the matching `vertical_*` Cognito group.
 */
export const handler = async (event) => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event;
  }
  const attrs = event.request.userAttributes || {};
  let agencyId = String(attrs["custom:agencyId"] ?? "").trim();
  let role = String(attrs["custom:role"] ?? "").trim();
  const email = String(attrs.email ?? "").trim();

  if (!agencyId) {
    agencyId = process.env.SELF_SIGNUP_DEFAULT_AGENCY_ID?.trim() || "";
    role = role || (process.env.SELF_SIGNUP_DEFAULT_ROLE || "dispatcher").trim();
    if (!agencyId) {
      console.warn(
        "SELF_SIGNUP_DEFAULT_AGENCY_ID unset; leaving custom:agencyId empty — user cannot call the API until an admin sets attributes.",
      );
    } else {
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
    }
  }

  await assignVerticalGroup({
    userPoolId: event.userPoolId,
    username: event.userName,
    agencyId,
    role,
    email,
  });
  return event;
};

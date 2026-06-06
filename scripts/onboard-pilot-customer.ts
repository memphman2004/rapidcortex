import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { buildAgencySlug } from "rapid-cortex-shared";

/**
 * `agencyId` is server-derived from `state + city + centerName`; never accepted from input.
 * Mirrors `createAgencyBodySchema` in `packages/shared/src/tenancy/schemas.ts`.
 */
type AgencyCreateInput = {
  city: string;
  centerName: string;
  state: string;
  name: string;
  type:
    | "city"
    | "county"
    | "municipality"
    | "regional_center"
    | "pilot"
    | "state_agency";
  region: string;
  primaryContactName: string;
  primaryContactEmail: string;
  deploymentMode: "side_by_side" | "partially_integrated" | "integrated";
  protocolPackId: string;
  retentionPolicyId: string;
  integrationMode:
    | "none"
    | "demo_only"
    | "mock_adapters"
    | "live_transcript"
    | "cad_read_only"
    | "bidirectional";
};

type AgencyPatchInput = Record<string, unknown>;

/**
 * Real product role names accepted from operators. `commsupervisor` is the legacy alias
 * still surfaced in onboarding docs; we normalize it to canonical `supervisor` before
 * writing to the API (which validates against `AGENCY_ROLE_SCHEMA`).
 */
type PilotUserRoleInput =
  | "dispatcher"
  | "supervisor"
  | "commsupervisor"
  | "agencyadmin";

type CanonicalAgencyRole = "dispatcher" | "supervisor" | "agencyadmin";

type PilotUser = {
  email: string;
  role: PilotUserRoleInput;
  temporaryPassword: string;
};

const CANONICAL_ROLE_BY_INPUT: Record<PilotUserRoleInput, CanonicalAgencyRole> = {
  dispatcher: "dispatcher",
  supervisor: "supervisor",
  commsupervisor: "supervisor",
  agencyadmin: "agencyadmin",
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseJsonEnv<T>(name: string, required = false): T | undefined {
  const raw = process.env[name];
  if (!raw || !raw.trim()) {
    if (required) throw new Error(`Missing required JSON env: ${name}`);
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function getStackOutput(stackName: string, region: string, key: string): Promise<string> {
  const { execSync } = await import("node:child_process");
  const command =
    `aws cloudformation describe-stacks --region "${region}" --stack-name "${stackName}" ` +
    `--query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" --output text`;
  const output = execSync(command, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  if (!output || output === "None") {
    throw new Error(`Missing CloudFormation output '${key}' for stack ${stackName}.`);
  }
  return output;
}

async function cognitoAuth(params: {
  region: string;
  clientId: string;
  username: string;
  password: string;
}): Promise<string> {
  const client = new CognitoIdentityProviderClient({ region: params.region });
  const auth = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: params.clientId,
      AuthParameters: {
        USERNAME: params.username,
        PASSWORD: params.password,
      },
    }),
  );
  const token = auth.AuthenticationResult?.IdToken;
  if (!token) {
    throw new Error(
      `Failed to authenticate ${params.username}. Verify user state/MFA/password requirements.`,
    );
  }
  return token;
}

async function apiRequest<T>(
  baseUrl: string,
  path: string,
  token: string,
  init?: RequestInit,
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed as T };
}

/**
 * Strip server-derived / unknown fields from agency create input so the request body
 * exactly matches `createAgencyBodySchema`. Operators sometimes carry forward
 * `agencyId` from older runbooks — silently drop it (server slugs from city+state).
 */
function sanitizeAgencyCreate(raw: Record<string, unknown>): AgencyCreateInput {
  const required: Array<keyof AgencyCreateInput> = [
    "city",
    "centerName",
    "state",
    "name",
    "type",
    "region",
    "primaryContactName",
    "primaryContactEmail",
    "deploymentMode",
    "protocolPackId",
    "retentionPolicyId",
    "integrationMode",
  ];
  const missing = required.filter((k) => !(k in raw) || raw[k] == null || raw[k] === "");
  if (missing.length > 0) {
    throw new Error(
      `PILOT_AGENCY_CREATE_JSON missing required fields: ${missing.join(", ")}`,
    );
  }
  const {
    city,
    centerName,
    state,
    name,
    type,
    region,
    primaryContactName,
    primaryContactEmail,
    deploymentMode,
    protocolPackId,
    retentionPolicyId,
    integrationMode,
  } = raw as AgencyCreateInput;
  return {
    city,
    centerName,
    state,
    name,
    type,
    region,
    primaryContactName,
    primaryContactEmail,
    deploymentMode,
    protocolPackId,
    retentionPolicyId,
    integrationMode,
  };
}

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const stage = process.env.STAGE?.trim() || "staging";
  const stackName = process.env.STACK_NAME?.trim() || `rapid-cortex-${stage}`;

  const agencyCreateRaw = parseJsonEnv<Record<string, unknown>>("PILOT_AGENCY_CREATE_JSON", true)!;
  if ("agencyId" in agencyCreateRaw) {
    console.warn(
      "[onboard-pilot-customer] ignoring 'agencyId' in PILOT_AGENCY_CREATE_JSON — server derives the slug from state+city+centerName.",
    );
    delete agencyCreateRaw.agencyId;
  }
  const agencyCreate = sanitizeAgencyCreate(agencyCreateRaw);
  const agencyPatch = parseJsonEnv<AgencyPatchInput>("PILOT_AGENCY_PATCH_JSON");
  const users = parseJsonEnv<PilotUser[]>("PILOT_CUSTOMER_USERS_JSON", true)!;

  for (const user of users) {
    if (!CANONICAL_ROLE_BY_INPUT[user.role]) {
      throw new Error(
        `Unsupported role '${user.role}' for ${user.email}. ` +
          `Allowed: dispatcher | supervisor | commsupervisor | agencyadmin.`,
      );
    }
  }
  const expectedRoles: Array<PilotUserRoleInput> = ["dispatcher", "agencyadmin"];
  for (const role of expectedRoles) {
    const present = users.some((u) => CANONICAL_ROLE_BY_INPUT[u.role] === CANONICAL_ROLE_BY_INPUT[role]);
    if (!present) {
      throw new Error(`PILOT_CUSTOMER_USERS_JSON must include a ${role} account.`);
    }
  }
  const supervisorPresent = users.some(
    (u) => CANONICAL_ROLE_BY_INPUT[u.role] === "supervisor",
  );
  if (!supervisorPresent) {
    throw new Error(
      "PILOT_CUSTOMER_USERS_JSON must include a supervisor (commsupervisor or supervisor) account.",
    );
  }

  const superadminUsername = requireEnv("PILOT_SUPERADMIN_USERNAME");
  const superadminPassword = requireEnv("PILOT_SUPERADMIN_PASSWORD");

  const apiUrl = process.env.API_BASE_URL?.trim() || (await getStackOutput(stackName, region, "HttpApiUrl"));
  const userPoolClientId =
    process.env.COGNITO_APP_CLIENT_ID?.trim() ||
    (await getStackOutput(stackName, region, "UserPoolClientId"));

  console.log(`[onboard-pilot-customer] stage=${stage} stack=${stackName} region=${region}`);
  console.log(`[onboard-pilot-customer] api=${apiUrl}`);
  console.log(`[onboard-pilot-customer] dryRun=${dryRun}`);

  const expectedSlug = buildAgencySlug({
    state: agencyCreate.state,
    city: agencyCreate.city,
    centerName: agencyCreate.centerName,
  }).slug;
  console.log(`[onboard-pilot-customer] expected agencyId slug=${expectedSlug}`);

  const superadminToken = await cognitoAuth({
    region,
    clientId: userPoolClientId,
    username: superadminUsername,
    password: superadminPassword,
  });

  /** Resolved at runtime — set from the create-201 response or from the local slug fallback on 409. */
  let resolvedAgencyId: string | null = null;

  if (!dryRun) {
    const createAgencyRes = await apiRequest<{ agencyId?: string; error?: string }>(
      apiUrl,
      "/api/agencies",
      superadminToken,
      { method: "POST", body: JSON.stringify(agencyCreate) },
    );
    if (createAgencyRes.status === 201 || createAgencyRes.status === 200) {
      resolvedAgencyId = createAgencyRes.body.agencyId ?? null;
      console.log(
        `[onboard-pilot-customer] agency created status=${createAgencyRes.status} agencyId=${resolvedAgencyId ?? "(missing in response)"}`,
      );
    } else if (createAgencyRes.status === 409) {
      resolvedAgencyId = expectedSlug;
      console.log(
        `[onboard-pilot-customer] agency already exists (409); using derived slug agencyId=${resolvedAgencyId}`,
      );
    } else {
      throw new Error(
        `Agency creation failed (${createAgencyRes.status}): ${JSON.stringify(createAgencyRes.body)}`,
      );
    }

    if (!resolvedAgencyId) {
      throw new Error("Could not resolve agencyId from create response.");
    }

    if (agencyPatch) {
      const patchRes = await apiRequest(apiUrl, `/api/agencies/${resolvedAgencyId}`, superadminToken, {
        method: "PATCH",
        body: JSON.stringify(agencyPatch),
      });
      if (![200].includes(patchRes.status)) {
        throw new Error(`Agency patch failed (${patchRes.status}): ${JSON.stringify(patchRes.body)}`);
      }
      console.log("[onboard-pilot-customer] agency patch status=200");
    }

    for (const user of users) {
      const canonicalRole = CANONICAL_ROLE_BY_INPUT[user.role];
      const createUserRes = await apiRequest(apiUrl, "/api/admin/users", superadminToken, {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          role: canonicalRole,
          agencyId: resolvedAgencyId,
          temporaryPassword: user.temporaryPassword,
        }),
      });
      if (![200, 201].includes(createUserRes.status)) {
        throw new Error(
          `User create failed for ${user.email} (${createUserRes.status}): ${JSON.stringify(createUserRes.body)}`,
        );
      }
      console.log(
        `[onboard-pilot-customer] created user ${user.email} role=${canonicalRole}` +
          (canonicalRole !== user.role ? ` (input '${user.role}' normalized)` : ""),
      );
    }
  } else {
    resolvedAgencyId = expectedSlug;
    console.log("[onboard-pilot-customer] DRY RUN: skipping create/patch API writes.");
  }

  console.log("[onboard-pilot-customer] validating role-based access...");
  for (const user of users) {
    const userToken = await cognitoAuth({
      region,
      clientId: userPoolClientId,
      username: user.email,
      password: user.temporaryPassword,
    });
    const meRes = await apiRequest<{ role?: string; agencyId?: string }>(apiUrl, "/api/me", userToken, {
      method: "GET",
    });
    if (meRes.status !== 200) {
      throw new Error(`Role check failed for ${user.email}: /api/me status ${meRes.status}`);
    }
    console.log(
      `[onboard-pilot-customer] /api/me ${user.email} -> role=${meRes.body.role ?? "unknown"} agency=${meRes.body.agencyId ?? "unknown"}`,
    );
  }

  const cadEnabled = process.env.PILOT_CAD_SMOKE === "true";
  if (cadEnabled) {
    console.log("[onboard-pilot-customer] running CAD smoke checks...");
    const admin = users.find((u) => CANONICAL_ROLE_BY_INPUT[u.role] === "agencyadmin");
    if (!admin) {
      throw new Error("PILOT_CAD_SMOKE requires an agencyadmin user in PILOT_CUSTOMER_USERS_JSON.");
    }
    const adminToken = await cognitoAuth({
      region,
      clientId: userPoolClientId,
      username: admin.email,
      password: admin.temporaryPassword,
    });
    const health = await apiRequest(apiUrl, "/api/cad/health", adminToken, { method: "GET" });
    console.log(`[onboard-pilot-customer] /api/cad/health status=${health.status}`);
    const incidents = await apiRequest(apiUrl, "/api/cad/incidents", adminToken, { method: "GET" });
    console.log(`[onboard-pilot-customer] /api/cad/incidents status=${incidents.status}`);
  }

  const callVolume = Number(process.env.PILOT_EXPECTED_CALL_VOLUME ?? "0");
  if (callVolume > 0) {
    const concurrency = Number(process.env.PILOT_LOAD_CONCURRENCY ?? "20");
    const { execSync } = await import("node:child_process");
    const command =
      `API_BASE_URL="${apiUrl}" CONCURRENCY="${concurrency}" REQUESTS="${callVolume}" ` +
      `bash scripts/pilot-load-smoke.sh`;
    execSync(command, { stdio: "inherit" });
  }

  console.log(`[onboard-pilot-customer] complete. agencyId=${resolvedAgencyId}`);
}

main().catch((error) => {
  console.error("[onboard-pilot-customer] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

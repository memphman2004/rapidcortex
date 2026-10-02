/**
 * Agency SAML SSO — Cognito Identity Provider CRUD.
 * ProviderName: SAML-${agencyId}
 *
 * Wired through FeaturesHttp catch-all:
 *   GET    /api/features/agency/sso
 *   PUT    /api/features/agency/sso
 *   DELETE /api/features/agency/sso
 */

import {
  CognitoIdentityProviderClient,
  CreateIdentityProviderCommand,
  DeleteIdentityProviderCommand,
  DescribeIdentityProviderCommand,
  DescribeUserPoolClientCommand,
  UpdateIdentityProviderCommand,
  UpdateUserPoolClientCommand,
  type IdentityProviderTypeType,
  type UserPoolClientType,
} from "@aws-sdk/client-cognito-identity-provider";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  configureAgencySsoBodySchema,
  FEATURES_AUDIT_EVENT_TYPES,
  normalizeSessionRole,
  type ConfigureAgencySsoBody,
} from "rapid-cortex-shared";
import {
  AuthorizationService,
  isRcAdmin,
  isRcSuperAdmin,
} from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { ddb } from "../repositories/baseRepository.js";
import {
  FeatureError,
  featureBadRequest,
  featureForbidden,
  featureNotFound,
  writeFeatureAudit,
  type FeatureActor,
} from "../feature-suite/errors.js";

const authz = new AuthorizationService();

function cognitoClient(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({ region: env.region });
}

export function samlProviderName(agencyId: string): string {
  return `SAML-${agencyId}`;
}

function requireUserPoolId(): string {
  const poolId = env.cognitoUserPoolId?.trim();
  if (!poolId) {
    throw new FeatureError(503, "COGNITO_USER_POOL_ID is not configured");
  }
  return poolId;
}

function requireClientId(): string | null {
  const clientId = env.cognitoClientId?.trim();
  return clientId || null;
}

function clientUpdateFromDescribe(
  existing: UserPoolClientType,
  supportedIdentityProviders: string[],
) {
  return {
    UserPoolId: existing.UserPoolId!,
    ClientId: existing.ClientId!,
    ClientName: existing.ClientName,
    RefreshTokenValidity: existing.RefreshTokenValidity,
    AccessTokenValidity: existing.AccessTokenValidity,
    IdTokenValidity: existing.IdTokenValidity,
    TokenValidityUnits: existing.TokenValidityUnits,
    ReadAttributes: existing.ReadAttributes,
    WriteAttributes: existing.WriteAttributes,
    ExplicitAuthFlows: existing.ExplicitAuthFlows,
    SupportedIdentityProviders: supportedIdentityProviders,
    CallbackURLs: existing.CallbackURLs,
    LogoutURLs: existing.LogoutURLs,
    DefaultRedirectURI: existing.DefaultRedirectURI,
    AllowedOAuthFlows: existing.AllowedOAuthFlows,
    AllowedOAuthScopes: existing.AllowedOAuthScopes,
    AllowedOAuthFlowsUserPoolClient: existing.AllowedOAuthFlowsUserPoolClient,
    EnableTokenRevocation: existing.EnableTokenRevocation,
    EnablePropagateAdditionalUserContextData:
      existing.EnablePropagateAdditionalUserContextData,
    AuthSessionValidity: existing.AuthSessionValidity,
    PreventUserExistenceErrors: existing.PreventUserExistenceErrors,
  };
}

/** Attach or detach a SAML IdP on the web app client (Hosted UI / federation). */
async function syncClientSupportedIdp(
  providerName: string,
  mode: "add" | "remove",
): Promise<void> {
  const clientId = requireClientId();
  if (!clientId) {
    console.warn(
      "[agency-sso] COGNITO_CLIENT_ID unset — skipping SupportedIdentityProviders sync",
      { providerName, mode },
    );
    return;
  }
  const userPoolId = requireUserPoolId();
  const client = cognitoClient();
  const described = await client.send(
    new DescribeUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
    }),
  );
  const existing = described.UserPoolClient;
  if (!existing?.ClientId) {
    console.warn("[agency-sso] UserPoolClient not found for SupportedIdentityProviders sync", {
      clientId,
    });
    return;
  }

  const current = new Set(existing.SupportedIdentityProviders ?? []);
  // Always keep native Cognito username/password alongside SAML.
  current.add("COGNITO");
  if (mode === "add") current.add(providerName);
  else current.delete(providerName);

  await client.send(
    new UpdateUserPoolClientCommand(
      clientUpdateFromDescribe(existing, Array.from(current).sort()),
    ),
  );
}

/** agencyadmin (same tenant), rcadmin, or rcsuperadmin. */
export function assertCanManageAgencySso(actor: FeatureActor, targetAgencyId: string): void {
  const role = normalizeSessionRole(String(actor.role ?? ""));
  if (isRcSuperAdmin(role) || isRcAdmin(role)) return;
  try {
    authz.assertAgencyAdminManagingSameAgency(
      {
        userId: actor.userId,
        agencyId: actor.agencyId,
        role: role as never,
      },
      targetAgencyId,
    );
    return;
  } catch {
    throw featureForbidden("SSO management requires agencyadmin, rcadmin, or rcsuperadmin");
  }
}

async function persistAgencySsoFlags(
  agencyId: string,
  flags: { ssoEnabled: boolean; samlProviderName: string | null },
): Promise<void> {
  const table = env.agenciesTable;
  if (!table) return;
  const now = new Date().toISOString();
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: { agencyId },
        UpdateExpression: "SET ssoEnabled = :e, samlProviderName = :n, updatedAt = :u",
        ExpressionAttributeValues: {
          ":e": flags.ssoEnabled,
          ":n": flags.samlProviderName,
          ":u": now,
        },
        ConditionExpression: "attribute_exists(agencyId)",
      }),
    );
  } catch (err) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "";
    if (name === "ConditionalCheckFailedException") {
      console.warn("[agency-sso] agency row missing; SSO flags not persisted", { agencyId });
      return;
    }
    console.warn("[agency-sso] failed to persist SSO flags", {
      agencyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function providerDetailsFromBody(body: ConfigureAgencySsoBody): Record<string, string> {
  const details: Record<string, string> = {};
  if (body.metadataUrl) details.MetadataURL = body.metadataUrl;
  if (body.metadataFile) details.MetadataFile = body.metadataFile;
  if (!details.MetadataURL && !details.MetadataFile) {
    throw featureBadRequest("Provide metadataUrl or metadataFile");
  }
  return details;
}

export async function describeAgencySso(
  actor: FeatureActor,
  agencyId = actor.agencyId,
): Promise<{
  configured: boolean;
  providerName: string;
  ssoEnabled: boolean;
  provider?: Record<string, unknown>;
}> {
  assertCanManageAgencySso(actor, agencyId);
  const userPoolId = requireUserPoolId();
  const providerName = samlProviderName(agencyId);

  try {
    const out = await cognitoClient().send(
      new DescribeIdentityProviderCommand({
        UserPoolId: userPoolId,
        ProviderName: providerName,
      }),
    );
    const idp = out.IdentityProvider;
    return {
      configured: true,
      providerName,
      ssoEnabled: true,
      provider: idp
        ? {
            providerName: idp.ProviderName,
            providerType: idp.ProviderType,
            attributeMapping: idp.AttributeMapping,
            idpIdentifiers: idp.IdpIdentifiers,
            lastModifiedDate: idp.LastModifiedDate?.toISOString?.() ?? undefined,
            creationDate: idp.CreationDate?.toISOString?.() ?? undefined,
          }
        : undefined,
    };
  } catch (err) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "";
    if (name === "ResourceNotFoundException") {
      return { configured: false, providerName, ssoEnabled: false };
    }
    throw err;
  }
}

export async function configureAgencySso(
  actor: FeatureActor,
  body: unknown,
  agencyId = actor.agencyId,
): Promise<{ providerName: string; action: "created" | "updated" }> {
  assertCanManageAgencySso(actor, agencyId);
  const parsed = configureAgencySsoBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw featureBadRequest(
      parsed.error.issues.map((i: { message: string }) => i.message).join("; ") || "Invalid body",
    );
  }

  const userPoolId = requireUserPoolId();
  const providerName = samlProviderName(agencyId);
  const providerDetails = providerDetailsFromBody(parsed.data);
  const attributeMapping = parsed.data.attributeMapping ?? { email: "email" };
  const idpIdentifiers = parsed.data.idpIdentifiers;
  const client = cognitoClient();

  let action: "created" | "updated" = "created";
  try {
    await client.send(
      new DescribeIdentityProviderCommand({
        UserPoolId: userPoolId,
        ProviderName: providerName,
      }),
    );
    action = "updated";
    await client.send(
      new UpdateIdentityProviderCommand({
        UserPoolId: userPoolId,
        ProviderName: providerName,
        ProviderDetails: providerDetails,
        AttributeMapping: attributeMapping,
        IdpIdentifiers: idpIdentifiers,
      }),
    );
  } catch (err) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "";
    if (name !== "ResourceNotFoundException") throw err;
    await client.send(
      new CreateIdentityProviderCommand({
        UserPoolId: userPoolId,
        ProviderName: providerName,
        ProviderType: "SAML" satisfies IdentityProviderTypeType,
        ProviderDetails: providerDetails,
        AttributeMapping: attributeMapping,
        IdpIdentifiers: idpIdentifiers,
      }),
    );
    action = "created";
  }

  await persistAgencySsoFlags(agencyId, { ssoEnabled: true, samlProviderName: providerName });

  try {
    await syncClientSupportedIdp(providerName, "add");
  } catch (err) {
    console.warn("[agency-sso] SupportedIdentityProviders add failed (IdP still configured)", {
      providerName,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.AGENCY_SSO_CONFIGURED,
    details: {
      action,
      providerName,
      providerType: "SAML",
    },
    resourceType: "agency",
    resourceId: agencyId,
  });

  return { providerName, action };
}

export async function deleteAgencySso(
  actor: FeatureActor,
  agencyId = actor.agencyId,
): Promise<{ deleted: boolean; providerName: string }> {
  assertCanManageAgencySso(actor, agencyId);
  const userPoolId = requireUserPoolId();
  const providerName = samlProviderName(agencyId);

  try {
    // Detach from app client before deleting IdP (Cognito rejects delete while still referenced).
    await syncClientSupportedIdp(providerName, "remove");
  } catch (err) {
    console.warn("[agency-sso] SupportedIdentityProviders remove failed; attempting IdP delete", {
      providerName,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await cognitoClient().send(
      new DeleteIdentityProviderCommand({
        UserPoolId: userPoolId,
        ProviderName: providerName,
      }),
    );
  } catch (err) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "";
    if (name === "ResourceNotFoundException") {
      throw featureNotFound(`SAML identity provider ${providerName} not found`);
    }
    throw err;
  }

  await persistAgencySsoFlags(agencyId, { ssoEnabled: false, samlProviderName: null });

  await writeFeatureAudit({
    agencyId,
    actorId: actor.userId,
    type: FEATURES_AUDIT_EVENT_TYPES.AGENCY_SSO_DELETED,
    details: {
      action: "deleted",
      providerName,
      providerType: "SAML",
    },
    resourceType: "agency",
    resourceId: agencyId,
  });

  return { deleted: true, providerName };
}

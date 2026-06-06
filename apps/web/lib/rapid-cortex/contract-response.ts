import "server-only";

import { NextResponse } from "next/server";
import { isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import { loadAgencyFeatureConfig } from "@/lib/rapid-cortex/agency-config-service";
import { requireFeatureAccess } from "@/lib/rapid-cortex/entitlements";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
/**
 * Standard body when backend dependencies are missing. HTTP 200 with explicit status
 * (clients should not treat 501 for expected pilot gaps).
 */
export function configurationRequiredResponse(input: {
  featureId: string;
  message: string;
  missingConfiguration: string[];
  nextAction: string;
  extra?: Record<string, unknown>;
}) {
  return NextResponse.json(
    {
      status: "configuration_required" as const,
      featureId: input.featureId,
      message: input.message,
      missingConfiguration: input.missingConfiguration,
      nextAction: input.nextAction,
      ...input.extra,
    },
    { status: 200 },
  );
}

/**
 * @deprecated name — returns structured `configuration_required` (not HTTP 501).
 *
 * TODO(prod) — Section 4.2: Some pilot routes deliberately return HTTP 200 + configuration_required instead of RFC 501.
 * Reconcile with procurement expectations — if callers need strict HTTP semantics, expose an alternate helper returning 501 JSON.
 */
export function notConfigured(
  featureId: string,
  message: string,
  extras?: Record<string, unknown> & {
    missingConfiguration?: string[];
    nextAction?: string;
  },
) {
  return configurationRequiredResponse({
    featureId,
    message,
    missingConfiguration: extras?.missingConfiguration ?? [],
    nextAction: extras?.nextAction ?? "Complete required environment and provider configuration before production use.",
    extra: extras ? { ...extras, missingConfiguration: undefined, nextAction: undefined } : undefined,
  });
}

export async function withFeatureContract(
  featureId: string,
  handler: (ctx: { agencyConfig: AgencyFeatureConfig }) => Promise<NextResponse>,
) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let agencyConfig: AgencyFeatureConfig;
  try {
    agencyConfig = await loadAgencyFeatureConfig(user);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agency configuration could not be loaded.";
    console.error(
      JSON.stringify({
        msg: "agency_feature_config_load_error",
        featureId,
        agencyId: user.agencyId,
        error: message,
      }),
    );
    return NextResponse.json(
      {
        error: "Agency configuration unavailable",
        message,
        hint: "Verify AGENCY_CONFIG_TABLE_NAME and DynamoDB access on the web service.",
      },
      { status: 503 },
    );
  }
  if (!isRcsuperadmin(user)) {
    try {
      requireFeatureAccess(agencyConfig, featureId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Feature access denied.";
      return NextResponse.json({ error: "Feature unavailable", message }, { status: 403 });
    }
  }

  return handler({ agencyConfig });
}

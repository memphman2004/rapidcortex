import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import {
  fetchAdminAnalyticsSummary,
  fetchAgencies,
  fetchAgencyAdminAccessOverridesList,
  fetchApiHealth,
  fetchAuditEvents,
  fetchIncidents,
  fetchMe,
  fetchQaSessions,
  isApiConfigured,
} from "@/lib/api";
import { fetchHospitalPortalContext } from "@/lib/hospital-portal/api";

export type IntegrationCheckId = "cognito" | "api" | "lambda" | "dynamodb";

export type IntegrationCheckResult = {
  id: IntegrationCheckId;
  label: string;
  ok: boolean;
  detail: string;
};

async function checkCognitoSession(): Promise<IntegrationCheckResult> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
    if (!res.ok) {
      return {
        id: "cognito",
        label: "Cognito session",
        ok: false,
        detail: `Session HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as { user?: { email?: string } | null };
    if (!body.user?.email) {
      return {
        id: "cognito",
        label: "Cognito session",
        ok: false,
        detail: "No signed-in user in session",
      };
    }
    return {
      id: "cognito",
      label: "Cognito session",
      ok: true,
      detail: body.user.email,
    };
  } catch (e) {
    return {
      id: "cognito",
      label: "Cognito session",
      ok: false,
      detail: e instanceof Error ? e.message : "Session check failed",
    };
  }
}

async function checkApiGateway(): Promise<IntegrationCheckResult> {
  if (!isApiConfigured()) {
    return {
      id: "api",
      label: "API connectivity",
      ok: false,
      detail: "Use /api/backend BFF or set NEXT_PUBLIC_API_BASE",
    };
  }
  try {
    const health = await fetchApiHealth();
    return {
      id: "api",
      label: "API connectivity",
      ok: ["ok", "healthy", "up"].includes(String(health.status).toLowerCase()),
      detail: `${health.service}${health.deploymentStage ? ` · ${health.deploymentStage}` : ""}`,
    };
  } catch (e) {
    return {
      id: "api",
      label: "API connectivity",
      ok: false,
      detail: e instanceof Error ? e.message : "Upstream health failed",
    };
  }
}

async function runDomainProbe(prefix: DashboardPrefix): Promise<{
  lambda: IntegrationCheckResult;
  dynamodb: IntegrationCheckResult;
}> {
  const fail = (id: IntegrationCheckId, label: string, detail: string): IntegrationCheckResult => ({
    id,
    label,
    ok: false,
    detail,
  });

  if (!isApiConfigured()) {
    const msg = "API not configured — cannot probe Lambda/DynamoDB";
    return {
      lambda: fail("lambda", "Lambda handlers", msg),
      dynamodb: fail("dynamodb", "DynamoDB", msg),
    };
  }

  try {
    switch (prefix) {
      case "rc-admin": {
        const items = await fetchAgencies();
        return {
          lambda: {
            id: "lambda",
            label: "Lambda (platform)",
            ok: true,
            detail: "GET /api/agencies",
          },
          dynamodb: {
            id: "dynamodb",
            label: "DynamoDB (tenants)",
            ok: true,
            detail: `${items.length} agencies loaded`,
          },
        };
      }
      case "agency-admin": {
        await fetchAgencyAdminAccessOverridesList({ status: "active" });
        await fetchMe();
        return {
          lambda: {
            id: "lambda",
            label: "Lambda (agency admin)",
            ok: true,
            detail: "Access overrides + /api/me",
          },
          dynamodb: {
            id: "dynamodb",
            label: "DynamoDB (overrides)",
            ok: true,
            detail: "Override list readable",
          },
        };
      }
      case "dispatcher":
      case "supervisor": {
        const incidents = await fetchIncidents();
        return {
          lambda: {
            id: "lambda",
            label: "Lambda (incidents)",
            ok: true,
            detail: "GET /api/incidents",
          },
          dynamodb: {
            id: "dynamodb",
            label: "DynamoDB (incidents)",
            ok: true,
            detail: `${incidents.length} incidents in scope`,
          },
        };
      }
      case "qa": {
        const sessions = await fetchQaSessions();
        return {
          lambda: {
            id: "lambda",
            label: "Lambda (QA)",
            ok: true,
            detail: "GET /api/qa/sessions",
          },
          dynamodb: {
            id: "dynamodb",
            label: "DynamoDB (QA)",
            ok: true,
            detail: `${sessions.length} QA sessions`,
          },
        };
      }
      case "it-security": {
        const events = await fetchAuditEvents(5);
        return {
          lambda: {
            id: "lambda",
            label: "Lambda (audit)",
            ok: true,
            detail: "GET /api/audit/events",
          },
          dynamodb: {
            id: "dynamodb",
            label: "DynamoDB (audit)",
            ok: true,
            detail: `${events.length} recent events`,
          },
        };
      }
      case "executive": {
        await fetchAdminAnalyticsSummary();
        return {
          lambda: {
            id: "lambda",
            label: "Lambda (analytics)",
            ok: true,
            detail: "GET /api/admin/analytics/summary",
          },
          dynamodb: {
            id: "dynamodb",
            label: "DynamoDB (reporting)",
            ok: true,
            detail: "Analytics summary reachable",
          },
        };
      }
      case "hospital-admin":
      case "hospital-staff": {
        const ctx = await fetchHospitalPortalContext();
        return {
          lambda: {
            id: "lambda",
            label: "Lambda (hospital portal)",
            ok: true,
            detail: "GET /api/hospital-portal/context",
          },
          dynamodb: {
            id: "dynamodb",
            label: "DynamoDB (hospital capacity)",
            ok: true,
            detail: ctx.hospital.name,
          },
        };
      }
      default:
        return {
          lambda: fail("lambda", "Lambda handlers", "No probe for this dashboard"),
          dynamodb: fail("dynamodb", "DynamoDB", "No probe for this dashboard"),
        };
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Domain API failed";
    const msg =
      raw === "Load failed" || raw === "Failed to fetch"
        ? "Authenticated API call failed — ensure API_UPSTREAM_BASE is set and /api/backend proxy is reachable"
        : raw;
    return {
      lambda: fail("lambda", "Lambda handlers", msg),
      dynamodb: fail("dynamodb", "DynamoDB", msg),
    };
  }
}

/** Run Cognito, API Gateway, Lambda, and DynamoDB checks for a role dashboard. */
export async function runDashboardIntegrationChecks(
  prefix: DashboardPrefix,
): Promise<IntegrationCheckResult[]> {
  const [cognito, api, domain] = await Promise.all([
    checkCognitoSession(),
    checkApiGateway(),
    runDomainProbe(prefix),
  ]);
  return [cognito, api, domain.lambda, domain.dynamodb];
}

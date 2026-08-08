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
        label: "Sign-in",
        ok: false,
        detail: `Could not verify session (${res.status})`,
      };
    }
    const body = (await res.json()) as { user?: { email?: string } | null };
    if (!body.user?.email) {
      return {
        id: "cognito",
        label: "Sign-in",
        ok: false,
        detail: "No signed-in user",
      };
    }
    return {
      id: "cognito",
      label: "Sign-in",
      ok: true,
      detail: body.user.email,
    };
  } catch (e) {
    return {
      id: "cognito",
      label: "Sign-in",
      ok: false,
      detail: e instanceof Error ? e.message : "Sign-in check failed",
    };
  }
}

async function checkApiGateway(): Promise<IntegrationCheckResult> {
  if (!isApiConfigured()) {
    return {
      id: "api",
      label: "Platform connection",
      ok: false,
      detail: "Platform API is not configured for this environment",
    };
  }
  try {
    const health = await fetchApiHealth();
    return {
      id: "api",
      label: "Platform connection",
      ok: ["ok", "healthy", "up"].includes(String(health.status).toLowerCase()),
      detail: health.deploymentStage ? `Connected · ${health.deploymentStage}` : "Connected",
    };
  } catch (e) {
    return {
      id: "api",
      label: "Platform connection",
      ok: false,
      detail: e instanceof Error ? e.message : "Platform health check failed",
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
    const msg = "Platform API is not configured — cannot verify services";
    return {
      lambda: fail("lambda", "Application services", msg),
      dynamodb: fail("dynamodb", "Data access", msg),
    };
  }

  try {
    switch (prefix) {
      case "rc-admin": {
        const items = await fetchAgencies();
        return {
          lambda: {
            id: "lambda",
            label: "Application services",
            ok: true,
            detail: "Agency directory reachable",
          },
          dynamodb: {
            id: "dynamodb",
            label: "Data access",
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
            label: "Application services",
            ok: true,
            detail: "Admin profile reachable",
          },
          dynamodb: {
            id: "dynamodb",
            label: "Data access",
            ok: true,
            detail: "Access overrides readable",
          },
        };
      }
      case "dispatcher":
      case "supervisor": {
        const incidents = await fetchIncidents();
        return {
          lambda: {
            id: "lambda",
            label: "Application services",
            ok: true,
            detail: "Incidents API reachable",
          },
          dynamodb: {
            id: "dynamodb",
            label: "Data access",
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
            label: "Application services",
            ok: true,
            detail: "QA sessions reachable",
          },
          dynamodb: {
            id: "dynamodb",
            label: "Data access",
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
            label: "Application services",
            ok: true,
            detail: "Audit feed reachable",
          },
          dynamodb: {
            id: "dynamodb",
            label: "Data access",
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
            label: "Application services",
            ok: true,
            detail: "Analytics reachable",
          },
          dynamodb: {
            id: "dynamodb",
            label: "Data access",
            ok: true,
            detail: "Reporting summary reachable",
          },
        };
      }
      case "hospital-admin":
      case "hospital-staff": {
        const ctx = await fetchHospitalPortalContext();
        return {
          lambda: {
            id: "lambda",
            label: "Application services",
            ok: true,
            detail: "Hospital portal reachable",
          },
          dynamodb: {
            id: "dynamodb",
            label: "Data access",
            ok: true,
            detail: ctx.hospital.name,
          },
        };
      }
      default:
        return {
          lambda: fail("lambda", "Application services", "No check for this dashboard"),
          dynamodb: fail("dynamodb", "Data access", "No check for this dashboard"),
        };
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Service check failed";
    const msg =
      raw === "Load failed" || raw === "Failed to fetch"
        ? "Could not reach application services — try again or contact support"
        : raw;
    return {
      lambda: fail("lambda", "Application services", msg),
      dynamodb: fail("dynamodb", "Data access", msg),
    };
  }
}

/** Run sign-in, platform, application, and data checks for a role dashboard. */
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

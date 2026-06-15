import { WebhookEventIngressPlaceholder } from "rapid-cortex-integrations";
import { IntegrationSecurityPolicy } from "rapid-cortex-security";
import { redirect } from "next/navigation";
import { AdminIntegrationsShell } from "@/components/admin/admin-integrations-shell";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isStack2ApiPath, resolveUpstreamApiBase } from "@/lib/comms-api-path";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { cookies } from "next/headers";

type Props = { params: Promise<{ jurisdiction: string }> };

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export default async function AdminIntegrationsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);

  let allowedHostSuffixes = [".amazonaws.com", ".amazoncognito.com"];
  let webhookAdapterId = "webhook-event-ingress-placeholder";
  let loadError: string | null = null;

  try {
    const policy = new IntegrationSecurityPolicy().defaultPolicy();
    allowedHostSuffixes = policy.allowedHostSuffixes;
    webhookAdapterId = new WebhookEventIngressPlaceholder().adapterId;
  } catch (err) {
    console.error("[admin/integrations] policy init failed", err);
    loadError = "Could not load integration policy defaults.";
  }

  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_ID_TOKEN)?.value;
    if (!token) {
      redirect(`/${jurisdiction}/login?reason=session_expired`);
    }

    const path = "/api/integration/status";
    const base = resolveUpstreamApiBase(path);
    if (!base) {
      loadError =
        loadError ??
        (isStack2ApiPath(path)
          ? "Integration status API (stack 2) is not configured on this deployment."
          : "Integration status API is not configured on this deployment.");
    } else {
      const res = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (res.status === 401) {
        redirect(`/${jurisdiction}/login?reason=session_expired`);
      }
      if (!res.ok) {
        loadError = loadError ?? `Failed to load integration status (${res.status}).`;
      }
    }
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error("[admin/integrations SSR]", err);
    loadError = loadError ?? "Could not reach the integrations service. Try again.";
  }

  return (
    <AdminIntegrationsShell
      allowedHostSuffixes={allowedHostSuffixes}
      webhookAdapterId={webhookAdapterId}
      loadError={loadError}
    />
  );
}

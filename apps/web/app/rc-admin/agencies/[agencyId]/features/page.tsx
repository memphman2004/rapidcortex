import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { defaultPermissionForRole, isRcSuperAdmin } from "rapid-cortex-security";
import { marketingLoginPath } from "@/lib/marketing-links";
import { fetchAgency } from "@/lib/api";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { CadModuleCard } from "@/components/rc-admin/cad-module-card";
import { AgencyFeaturesClient } from "./agency-features-client";
import { EscalationSettingsPanel } from "../escalation-settings";
import { deriveVerticalFromAgencyId, normalizeVertical } from "@/lib/vertical";

export const metadata = {
  title: "Feature add-ons (NexCort Admin)",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ agencyId: string }> };

export default async function RcAdminAgencyFeaturesPage({ params }: Props) {
  const { agencyId } = await params;
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(
      `${marketingLoginPath()}?from=/rc-admin/agencies/${encodeURIComponent(agencyId)}/features`,
    );
  }

  const canEdit = defaultPermissionForRole(user.role, "billing.addons");
  const canView =
    canEdit || defaultPermissionForRole(user.role, "billing.usage_view");

  if (!canView) {
    redirect("/rc-admin");
  }

  let agencyName = agencyId;
  let agencyVertical = deriveVerticalFromAgencyId(agencyId);
  let featureFlags: Record<string, boolean> = {};
  try {
    const agency = await fetchAgency(agencyId);
    agencyName = agency.name ?? agencyId;
    const rawVertical = (agency as typeof agency & { vertical?: string }).vertical;
    agencyVertical = rawVertical ? normalizeVertical(rawVertical) : deriveVerticalFromAgencyId(agencyId);
    const withFlags = agency as typeof agency & {
      featureFlags?: Record<string, boolean>;
      entitlements?: { featureFlags?: Record<string, boolean> };
    };
    featureFlags = withFlags.entitlements?.featureFlags ?? withFlags.featureFlags ?? {};
  } catch {
    // keep id fallback
  }

  const manageAllAddons = isRcSuperAdmin(user.role);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Products for {agencyName}</h1>
      <p className="max-w-3xl text-sm text-slate-400">
        Turn a product on to make it available for this agency. Products included in the plan are already on.
        A monthly product that is on, and not already in the plan, is added to the automatic monthly invoice.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/billing`}
          className="hover:opacity-90"
          style={{ color: "var(--role-accent)" }}
        >
          ← Agency billing
        </Link>
        <Link
          href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/qr-codes`}
          className="hover:opacity-90"
          style={{ color: "var(--role-accent)" }}
        >
          QR Codes →
        </Link>
      </div>
      <CadModuleCard agencyId={agencyId} agencyName={agencyName} canEdit={canEdit} />
      <AgencyFeaturesClient
        tenantId={agencyId}
        agencyName={agencyName}
        canEdit={canEdit}
        vertical={agencyVertical}
        manageAllAddons={manageAllAddons}
        featureFlags={featureFlags}
      />
      {(agencyVertical === "venue" || agencyVertical === "campus") ? (
        <EscalationSettingsPanel agencyId={agencyId} />
      ) : null}
    </div>
  );
}

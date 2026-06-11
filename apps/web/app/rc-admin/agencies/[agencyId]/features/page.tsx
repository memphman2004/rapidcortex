import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { defaultPermissionForRole, isRcSuperAdmin } from "rapid-cortex-security";
import { marketingLoginPath } from "@/lib/marketing-links";
import { fetchAgency } from "@/lib/api";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { AgencyFeaturesClient } from "./agency-features-client";
import { deriveVerticalFromAgencyId, normalizeVertical } from "@/lib/vertical";

export const metadata = {
  title: "Feature add-ons (RC Admin)",
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
      <h1 className="text-2xl font-semibold text-white">Feature add-ons — {agencyName}</h1>
      <p className="max-w-3xl text-sm text-slate-400">
        Toggle paid add-ons and sync changes to the agency&apos;s open invoice. Plan-included features cannot be
        disabled.
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
      <AgencyFeaturesClient
        tenantId={agencyId}
        agencyName={agencyName}
        canEdit={canEdit}
        vertical={agencyVertical}
        manageAllAddons={manageAllAddons}
        featureFlags={featureFlags}
      />
    </div>
  );
}

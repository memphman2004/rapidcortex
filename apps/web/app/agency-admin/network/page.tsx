import { notFound, redirect } from "next/navigation";
import { defaultPermissionForRole } from "rapid-cortex-security";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isNetworkAccessSettingsUiEnabled } from "@/lib/runtime-flags";
import { NetworkPolicyEditor } from "@/components/network/network-policy-editor";

export const metadata = {
  title: "Network access",
  robots: { index: false, follow: false },
};

export default async function AgencyAdminNetworkPage() {
  if (!isNetworkAccessSettingsUiEnabled()) notFound();

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`${marketingLoginPath()}?from=/agency-admin/network`);
  }

  const canView = defaultPermissionForRole(user.role, "system.settings_view");
  const canEdit = defaultPermissionForRole(user.role, "system.settings_edit");
  if (!canView) redirect("/agency-admin/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Network access</h1>
      <p className="max-w-3xl text-sm text-slate-400">
        Configure authorized networks and shift hours for your agency. Changes apply to all non–RC-internal users.
      </p>
      <NetworkPolicyEditor
        agencyId={user.agencyId}
        agencyName={user.agencyId}
        canEdit={canEdit}
        backHref="/agency-admin/billing"
      />
    </div>
  );
}

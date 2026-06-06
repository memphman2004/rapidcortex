import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { defaultPermissionForRole } from "rapid-cortex-security";
import { marketingLoginPath } from "@/lib/marketing-links";
import { fetchAgency } from "@/lib/api";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isNetworkAccessSettingsUiEnabled } from "@/lib/runtime-flags";
import { NetworkPolicyEditor } from "@/components/network/network-policy-editor";

export const metadata = {
  title: "Network access (RC Admin)",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ agencyId: string }> };

export default async function RcAdminAgencyNetworkPage({ params }: Props) {
  if (!isNetworkAccessSettingsUiEnabled()) notFound();

  const { agencyId } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(
      `${marketingLoginPath()}?from=/rc-admin/agencies/${encodeURIComponent(agencyId)}/network`,
    );
  }

  const canView = defaultPermissionForRole(user.role, "system.settings_view");
  const canEdit = defaultPermissionForRole(user.role, "system.settings_edit");
  if (!canView) redirect("/rc-admin");

  let agencyName = agencyId;
  try {
    const agency = await fetchAgency(agencyId);
    agencyName = agency.name ?? agencyId;
  } catch {
    /* keep id */
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Network access — {agencyName}</h1>
      <p className="max-w-3xl text-sm text-slate-400">
        IP allowlist and shift-hour restrictions for this agency. RC internal roles are never subject to these
        controls.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/rc-admin/agencies" className="text-sky-400 hover:text-sky-300">
          ← All agencies
        </Link>
        <Link
          href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/billing`}
          className="text-sky-400 hover:text-sky-300"
        >
          Agency billing
        </Link>
      </div>
      <NetworkPolicyEditor
        agencyId={agencyId}
        agencyName={agencyName}
        canEdit={canEdit}
        backHref={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/billing`}
      />
    </div>
  );
}

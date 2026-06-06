import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { defaultPermissionForRole } from "rapid-cortex-security";

export default async function HospitalAdminUsersPage() {
  const user = await getDashboardSessionUser();
  if (!user) return null;

  const canManage = defaultPermissionForRole(user.role, "hospital_portal.users_manage");

  return <HospitalAdminUsersContent canManage={canManage} />;
}

function HospitalAdminUsersContent({ canManage }: { canManage: boolean }) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-6">
      <h1 className="text-lg font-semibold text-white">Staff access</h1>
      {canManage ? (
        <p className="max-w-2xl text-sm text-slate-400">
          Invite hospital staff from your agency administrator or use the hospital portal user API
          when wired to your identity provider. New users should receive the{" "}
          <span className="font-mono text-slate-300">hospitalstaff</span> role; facility leads use{" "}
          <span className="font-mono text-slate-300">hospitaladmin</span>.
        </p>
      ) : (
        <p className="text-sm text-rose-300">
          Your account cannot manage hospital portal users. Contact your hospital administrator.
        </p>
      )}
    </div>
  );
}

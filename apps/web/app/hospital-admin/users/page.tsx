import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canAccessHospitalAdminOnlyRoutes } from "@/lib/hospital/hospital-access";

export default async function HospitalAdminUsersPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  if (!canAccessHospitalAdminOnlyRoutes(user)) {
    redirect("/hospital-admin/dashboard");
  }

  return <HospitalAdminUsersContent />;
}

function HospitalAdminUsersContent() {
  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-6">
        <h1 className="text-lg font-semibold text-white">Staff access</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Invite hospital staff from your agency administrator or use the hospital portal user API
          when wired to your identity provider. New users should receive the{" "}
          <span className="font-mono text-slate-300">hospitalstaff</span> role; facility leads use{" "}
          <span className="font-mono text-slate-300">hospitaladmin</span>. EMS coordinators use{" "}
          <span className="font-mono text-slate-300">HOSPITAL_COORDINATOR</span>.
        </p>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canAccessHospitalAdminOnlyRoutes } from "@/lib/hospital/hospital-access";

export default async function HospitalAdminSettingsPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  if (!canAccessHospitalAdminOnlyRoutes(user)) {
    redirect("/hospital-admin/dashboard");
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-6">
        <h1 className="text-lg font-semibold text-white">Facility settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Configure facility profile, notification contacts, and integration credentials.
          Contact Rapid Cortex support to enable HL7 or API capacity feeds for your agency.
        </p>
      </div>
    </div>
  );
}

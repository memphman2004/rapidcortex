import { DashboardCard } from "@/components/ui/dashboard-card";
import { requireRole } from "@/lib/auth/require-role";

export default async function StaffDashboardPage() {
  await requireRole(["auditor", "rcsuperadmin", "rcsuperadmin"]);

  return (
    <div className="mx-auto w-full max-w-[var(--rc-content-max)] space-y-6 px-4 py-4 lg:px-6 lg:py-5 2xl:px-8">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold text-white">Staff Portal</h1>
        <p className="text-sm text-slate-400">
          Shift notifications and agency updates for agency staff.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <DashboardCard
          title="Shift Notes"
          description="View current shift notes and handoff messages."
          href="staff/shift-notes"
          status="active"
        />
        <DashboardCard
          title="Notifications"
          description="Agency-wide notifications and announcements."
          href="staff/notifications"
          status="active"
        />
      </div>
    </div>
  );
}

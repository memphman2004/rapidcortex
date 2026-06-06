import { RoleDashboardSmokePanel } from "@/components/dispatch/role-dashboard-smoke-panel";

export default function RcAdminSmokePage() {
  return (
    <div className="p-6">
      <RoleDashboardSmokePanel title="RC Admin" pathLabel="/[jurisdiction]/rc-admin" />
      <p className="text-sm text-slate-400">
        For full platform tools, use{" "}
        <span className="font-mono text-slate-300">/admin/platform/…</span> from the admin nav
        (Tenants, integrations, global audit, etc.).
      </p>
    </div>
  );
}

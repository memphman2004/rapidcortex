import { AdminAddUserRunbook } from "@/components/dispatch/admin-add-user-runbook";
import { AdminUsersPanel } from "@/components/dispatch/admin-users-panel";

export default function AdminUsersPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-lg font-semibold text-white">Users</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">
        Cognito user directory for your agency. Create users with a temporary password; first sign-in follows your
        pool policy (password change and MFA when required).
      </p>
      <div className="mt-6 space-y-6">
        <AdminAddUserRunbook />
        <AdminUsersPanel />
      </div>
    </div>
  );
}

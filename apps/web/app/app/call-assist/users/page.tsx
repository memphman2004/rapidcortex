"use client";

import { useSession } from "@/components/auth/session-context";
import { CallAssistChrome } from "@/components/call-assist/call-assist-chrome";
import { AdminUsersPanel } from "@/components/dispatch/admin-users-panel";
import { canAdminCallAssist } from "@/lib/call-assist/access";

export default function CallAssistUsersPage() {
  const { user } = useSession();
  if (!user) return null;
  if (!canAdminCallAssist(user.role)) {
    return <p className="p-6 text-sm text-rose-300">You do not have permission to manage Call Assist users.</p>;
  }
  return (
    <div className="p-4 md:p-6">
      <CallAssistChrome title="Call Assist users" />
      <p className="mb-4 max-w-xl text-sm text-slate-400">
        Invite operators and supervisors for this Call Assist tenant. These roles never land on the 911
        dispatcher console.
      </p>
      <AdminUsersPanel />
    </div>
  );
}

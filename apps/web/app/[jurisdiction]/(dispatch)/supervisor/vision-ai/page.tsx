"use client";

import { useSession } from "@/components/auth/session-context";
import { VisionAiSupervisorDashboard } from "@/components/rapid-vision/VisionAiSupervisorDashboard";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorVisionAiPage() {
  const { user } = useSession();
  if (
    !isSupervisorOrStaffRole(user?.role) &&
    user?.role !== "agencyadmin" &&
    user?.role !== "agencyit" &&
    user?.role !== "auditor" &&
    user?.role !== "analyst"
  ) {
    return <SupervisorAccessRestricted />;
  }
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Rapid Vision AI</h1>
        <p className="mt-1 text-sm text-slate-400">
          Agency-wide camera alerts. Dispatchers still confirm every action.
        </p>
      </div>
      <VisionAiSupervisorDashboard />
    </div>
  );
}

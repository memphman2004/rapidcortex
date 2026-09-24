"use client";

import { useSession } from "@/components/auth/session-context";
import { VisionAiAdminPanel } from "@/components/rapid-vision/VisionAiAdminPanel";
import { VisionAiSupervisorDashboard } from "@/components/rapid-vision/VisionAiSupervisorDashboard";
import { isRapidVisionSceneAdminEnabled, isRapidVisionSceneIntelEnabled } from "@/lib/runtime-flags";

const CONFIG_ROLES = new Set(["agencyadmin", "agencyit", "rcsuperadmin", "rcadmin", "rcitadmin"]);
const VIEW_ROLES = new Set([...CONFIG_ROLES, "auditor", "analyst"]);

export default function VisionAiAdminPage() {
  const { user } = useSession();
  if (!isRapidVisionSceneIntelEnabled()) {
    return <p className="p-6 text-sm text-slate-400">Scene Intelligence is not enabled.</p>;
  }
  if (!user || !VIEW_ROLES.has(user.role)) {
    return <p className="p-6 text-sm text-slate-400">Camera AI settings require agency admin, IT, or audit access.</p>;
  }
  const canConfig = isRapidVisionSceneAdminEnabled() && CONFIG_ROLES.has(user.role);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">NexiQ Vision AI monitoring</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Configure which cameras generate Scene Intelligence alerts. AI never creates an incident or
          dispatches units.
        </p>
      </div>
      {canConfig ? <VisionAiAdminPanel /> : null}
      <VisionAiSupervisorDashboard />
    </div>
  );
}

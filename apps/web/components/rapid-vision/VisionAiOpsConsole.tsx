"use client";

import { useSession } from "@/components/auth/session-context";
import { VisionAiAdminPanel } from "@/components/rapid-vision/VisionAiAdminPanel";
import { VisionAiSupervisorDashboard } from "@/components/rapid-vision/VisionAiSupervisorDashboard";
import { isRapidVisionSceneAdminEnabled, isRapidVisionSceneIntelEnabled } from "@/lib/runtime-flags";

const CONFIG_ROLES = new Set([
  "agencyadmin",
  "agencyit",
  "rcsuperadmin",
  "rcadmin",
  "rcitadmin",
  "CAMPUS_ADMIN",
  "VENUE_ADMIN",
  "TRANSIT_ADMIN",
  "campus_admin",
  "venue_admin",
  "transit_admin",
]);

export function VisionAiOpsConsole({
  title = "NexiQ Vision AI",
  subtitle = "AI surfaces camera alerts. Staff confirm every action — nothing auto-dispatches.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const { user } = useSession();
  if (!isRapidVisionSceneIntelEnabled()) {
    return <p className="p-6 text-sm text-slate-400">Scene Intelligence is not enabled.</p>;
  }
  const role = user?.role ?? "";
  const canConfig = isRapidVisionSceneAdminEnabled() && CONFIG_ROLES.has(role);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>
      </div>
      {canConfig ? <VisionAiAdminPanel /> : null}
      <VisionAiSupervisorDashboard />
    </div>
  );
}

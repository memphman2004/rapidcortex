import { Suspense } from "react";
import { redirect } from "next/navigation";
import { VideoWallClient } from "@/components/video/video-wall-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isRcVideoEnabled } from "@/lib/runtime-flags";
import { isVideoWallRoleBlocked } from "@/lib/video/video-wall-access";

export default async function CampusVideoWallPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const from = `/app/campus/${encodeURIComponent(campusCode)}/video-wall`;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=${encodeURIComponent(from)}`);
  }
  if (!isRcVideoEnabled() || isVideoWallRoleBlocked(user.role) || !user.agencyId) {
    redirect(`/app/campus/${encodeURIComponent(campusCode)}/cameras`);
  }
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading video wall…</p>}>
      <VideoWallClient agencyId={user.agencyId} apiVertical="campus" />
    </Suspense>
  );
}

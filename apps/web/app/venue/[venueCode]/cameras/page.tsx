import { redirect } from "next/navigation";
import { VenueCamerasClient } from "./venue-cameras-client";
import { VenueCamerasSettingsClient } from "@/components/venue/venue-cameras-settings-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { normalizeVenueRole } from "@/lib/venue/venue-dashboard-sections";

export default async function VenueCamerasPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/venue/${encodeURIComponent(venueCode)}/cameras`);
  }

  const rawRole = user.role.trim().toUpperCase();
  const venueRole = normalizeVenueRole(user.role);
  // Matches API `canSupervisorVenueOps` — registry CRUD is admin/supervisor (+ RC).
  const canManageRegistry =
    rawRole === "RCSUPERADMIN" ||
    rawRole === "RCADMIN" ||
    venueRole === "VENUE_ADMIN" ||
    venueRole === "VENUE_SUPERVISOR";

  return (
    <div className="space-y-8">
      {canManageRegistry && user.agencyId ? (
        <div className="p-6 pb-0">
          <VenueCamerasSettingsClient agencyId={user.agencyId} apiVertical="venue" />
        </div>
      ) : null}
      <VenueCamerasClient venueCode={venueCode} />
    </div>
  );
}

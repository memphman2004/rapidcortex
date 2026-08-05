import { redirect } from "next/navigation";
import { VenueOperationsShell } from "@/components/venue/venue-operations-shell";
import { VenueCamerasSettingsClient } from "@/components/venue/venue-cameras-settings-client";
import { agencyProfileVertical } from "@/lib/agency/profile-vertical";
import { fetchAgencyProfile } from "@/lib/agency/agency-profile";
import { canVenueAgencyIt } from "@/lib/venue/venue-access";
import { canVenueNotifications } from "@/lib/venue/venue-access";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";
import type { CameraApiVertical } from "@/lib/venue/venue-camera-api";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function VenueCamerasSettingsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const { user, venueName, linkBase, agencyId } = await loadVenueJurisdictionContext(jurisdiction);
  const profile = await fetchAgencyProfile(jurisdiction);
  const vertical = profile ? agencyProfileVertical(profile) : "venue";
  const apiVertical: CameraApiVertical = vertical === "campus" ? "campus" : "venue";

  if (!canVenueNotifications(user.role) && !canVenueAgencyIt(user.role)) {
    redirect(linkBase);
  }

  return (
    <VenueOperationsShell
      agencyId={agencyId}
      venueName={venueName}
      linkBase={linkBase}
      userEmail={user.email ?? ""}
      userRole={user.role}
      userId={user.userId}
    >
      <VenueCamerasSettingsClient agencyId={agencyId} apiVertical={apiVertical} />
    </VenueOperationsShell>
  );
}

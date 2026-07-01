import { redirect } from "next/navigation";
import { VenueStaffPanel } from "@/components/venue/venue-staff-panel";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function VenueStaffPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=/app/venue/${encodeURIComponent(venueCode)}/staff`);
  }

  return (
    <div className="p-2">
      <VenueStaffPanel agencyId={user.agencyId} linkBase={`/${user.agencyId}/venue`} />
    </div>
  );
}

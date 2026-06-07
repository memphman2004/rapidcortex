import { VenueHeader } from "./_components/VenueHeader";
import { VenueNav } from "./_components/VenueNav";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { normalizeVenueRole } from "@/lib/venue/venue-dashboard-sections";

export default async function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  const user = await getDashboardSessionUser();
  const role = normalizeVenueRole(user?.role);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-[1400px] space-y-4 p-4">
        <VenueHeader venueCode={venueCode} role={role} />
        <div className="flex flex-col gap-4 lg:flex-row">
          <VenueNav venueCode={venueCode} role={role} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}

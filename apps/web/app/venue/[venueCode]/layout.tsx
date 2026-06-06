import { VenueHeader } from "./_components/VenueHeader";
import { VenueNav } from "./_components/VenueNav";

export default async function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  // TODO: read from session/auth context
  const role = "VENUE_SUPERVISOR";

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

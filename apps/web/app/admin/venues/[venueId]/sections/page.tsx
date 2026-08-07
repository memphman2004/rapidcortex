import { redirect } from "next/navigation";

/** Alias for venue section layout admin — `/admin/venues/:venueId/sections`. */
export default async function VenueAdminSectionsRedirect({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  redirect(`/app/venue/${venueId.toUpperCase()}/sections`);
}

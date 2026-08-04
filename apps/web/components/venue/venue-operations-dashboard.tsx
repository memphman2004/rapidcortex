/**
 * Compatibility adapter — venue ops home UI lives in venue-console-home.tsx.
 */
"use client";

import { VenueConsoleHome } from "./venue-console-home";

export function VenueOperationsDashboard({
  agencyId,
  venueName = "Venue",
  agencySlug,
  linkBase: _linkBase,
  userEmail = "",
  userRole,
  displayName,
}: {
  agencyId: string;
  venueName?: string;
  agencySlug?: string;
  linkBase?: string;
  userEmail?: string;
  userRole?: string;
  displayName?: string;
}) {
  const venueCode = agencySlug ?? agencyId;
  const name =
    displayName?.trim() ||
    (userEmail.includes("@")
      ? userEmail.split("@")[0]!.replace(/[.+_-]/g, " ")
      : "Venue User");

  return (
    <VenueConsoleHome
      agencyId={agencyId}
      venueCode={venueCode}
      venueName={venueName}
      displayName={name}
      userEmail={userEmail}
      userRole={userRole}
    />
  );
}

export { VenueConsoleHome } from "./venue-console-home";

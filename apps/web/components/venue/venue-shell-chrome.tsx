"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { VenueHeader } from "@/app/venue/[venueCode]/_components/VenueHeader";
import { VenueNav } from "@/app/venue/[venueCode]/_components/VenueNav";
import { VenueGuestServicesDisclaimer } from "./venue-guest-services-disclaimer";

/**
 * Full console home owns its own chrome; sub-routes keep header + side nav.
 * Matches `/venue/{code}` and rewritten `/app/venue/{code}`.
 */
function isVenueConsoleHomePath(pathname: string, venueCode: string): boolean {
  const code = venueCode.toUpperCase();
  const patterns = [
    new RegExp(`^/venue/${code}/?$`, "i"),
    new RegExp(`^/app/venue/${code}/?$`, "i"),
  ];
  return patterns.some((re) => re.test(pathname));
}

export function VenueShellChrome({
  venueCode,
  role,
  userEmail,
  agencyId,
  isGuestServices,
  showNav,
  children,
}: {
  venueCode: string;
  role: string;
  userEmail?: string;
  agencyId?: string;
  isGuestServices: boolean;
  showNav: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const consoleHome = isVenueConsoleHomePath(pathname, venueCode);

  if (consoleHome) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4">
      {isGuestServices ? <VenueGuestServicesDisclaimer className="mb-2" /> : null}
      <VenueHeader
        venueCode={venueCode}
        role={role}
        userEmail={userEmail}
        agencyId={agencyId}
      />
      <div className="flex flex-col gap-4 lg:flex-row">
        {showNav ? <VenueNav venueCode={venueCode} role={role} /> : null}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

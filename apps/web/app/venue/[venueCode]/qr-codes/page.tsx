"use client";

import { use } from "react";
import { QrLocationsWorkspace } from "@/components/locations/qr-locations-workspace";

export default function VenueQrCodesPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);

  return (
    <QrLocationsWorkspace
      vertical="venue"
      orgCode={venueCode}
      title="Venue QR Codes"
      description="One QR code per zone — post at entrances, sections, and concourses for guest safety reports."
    />
  );
}

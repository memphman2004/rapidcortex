"use client";

import { use } from "react";
import { VenueZonesClient } from "../_components/VenueZonesClient";

export default function VenueZonesPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  return <VenueZonesClient venueCode={venueCode} />;
}

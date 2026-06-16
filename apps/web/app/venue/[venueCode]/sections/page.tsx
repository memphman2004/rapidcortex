"use client";

import { use } from "react";
import { VenueSectionConfig } from "@/components/venue/venue-section-config";

export default function VenueSectionsAdminPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  const normalized = venueCode.toUpperCase().replace(/-/g, "");

  return (
    <VenueSectionConfig
      venueId={normalized}
      venueName={normalized}
    />
  );
}

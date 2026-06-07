"use client";

import { use } from "react";
import { QrLocationsWorkspace } from "@/components/locations/qr-locations-workspace";

export default function CampusQrCodesPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = use(params);

  return (
    <QrLocationsWorkspace
      vertical="campus"
      orgCode={campusCode}
      title="Campus QR Codes"
      description="Register campus scan points and download print-ready QR assets for buildings and zones."
    />
  );
}

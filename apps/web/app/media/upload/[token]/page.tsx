import type { Metadata } from "next";
import { IncidentMediaUploadClient } from "@/components/dispatch/incident-media-upload-client";

export const metadata: Metadata = {
  title: "Upload incident media",
  robots: { index: false, follow: false },
};

export default async function IncidentMediaUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <IncidentMediaUploadClient token={token} />;
}

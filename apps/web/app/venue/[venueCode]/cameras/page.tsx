import { VenueCamerasClient } from "./venue-cameras-client";

export default async function VenueCamerasPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  return <VenueCamerasClient venueCode={venueCode} />;
}

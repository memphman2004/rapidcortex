import { VenueMobileSupervisor } from "./venue-mobile-supervisor";

export default async function VenueMobileSupervisorPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = await params;
  return <VenueMobileSupervisor venueCode={venueCode} />;
}

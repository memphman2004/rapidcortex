import type { Metadata } from "next";
import { ReportWizard } from "../_components/ReportWizard";

type VenuePageParams = { venueCode: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<VenuePageParams>;
}): Promise<Metadata> {
  const { venueCode } = await params;
  return {
    title: `Request Assistance | ${venueCode.toUpperCase()}`,
    robots: { index: false, follow: false },
  };
}

export default async function ReportByVenuePage({
  params,
}: {
  params: Promise<VenuePageParams>;
}) {
  const { venueCode } = await params;
  return (
    <ReportWizard
      initialVenueCode={venueCode.toUpperCase()}
      initialZoneCode=""
      initialZoneLabel=""
    />
  );
}

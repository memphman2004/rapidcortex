import type { Metadata } from "next";
import { ReportWizard } from "../../_components/ReportWizard";
import { humanizeZoneCode } from "../../_lib/humanize-zone-code";

type ZonePageParams = { venueCode: string; zoneCode: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<ZonePageParams>;
}): Promise<Metadata> {
  const { venueCode } = await params;
  return {
    title: `Request Assistance | ${venueCode.toUpperCase()}`,
    robots: { index: false, follow: false },
  };
}

export default async function ReportByZonePage({
  params,
}: {
  params: Promise<ZonePageParams>;
}) {
  const { venueCode: venueCodeParam, zoneCode: zoneCodeParam } = await params;
  const venueCode = venueCodeParam.toUpperCase();
  const zoneCode = zoneCodeParam.toUpperCase();
  const zoneLabel = humanizeZoneCode(zoneCode);

  return (
    <ReportWizard
      initialVenueCode={venueCode}
      initialZoneCode={zoneCode}
      initialZoneLabel={zoneLabel}
    />
  );
}

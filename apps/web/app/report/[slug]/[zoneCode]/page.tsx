import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isQrNfcSlug } from "@/lib/qr-nfc/is-qr-nfc-slug";
import { ReportWizard } from "../../_components/ReportWizard";
import { humanizeZoneCode } from "../../_lib/humanize-zone-code";

type ZonePageParams = { slug: string; zoneCode: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<ZonePageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Request Assistance | ${slug.toUpperCase()}`,
    robots: { index: false, follow: false },
  };
}

export default async function ReportByZonePage({
  params,
}: {
  params: Promise<ZonePageParams>;
}) {
  const { slug, zoneCode: zoneCodeParam } = await params;

  if (isQrNfcSlug(slug)) {
    redirect(`/report/${encodeURIComponent(slug)}`);
  }

  const venueCode = slug.toUpperCase();
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

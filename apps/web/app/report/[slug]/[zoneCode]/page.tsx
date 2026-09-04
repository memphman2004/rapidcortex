import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isQrNfcSlug } from "@/lib/qr-nfc/is-qr-nfc-slug";
import { LegacyReportShell } from "../../_components/LegacyReportShell";

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
  const { slug } = await params;

  if (isQrNfcSlug(slug)) {
    redirect(`/report/${encodeURIComponent(slug)}`);
  }

  return (
    <LegacyReportShell>
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-800">This reporting link is no longer active.</h1>
        <p className="mt-3 max-w-sm text-sm text-slate-500">
          Scan the QR code posted at this location, or call 911 for emergencies.
        </p>
      </section>
    </LegacyReportShell>
  );
}

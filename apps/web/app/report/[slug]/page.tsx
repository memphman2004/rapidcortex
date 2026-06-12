import type { Metadata } from "next";
import type { QRNFCPublicRecord, ReportMedium } from "rapid-cortex-shared";
import Link from "next/link";
import { QRNfcIntakeClient } from "@/components/qr-nfc/qr-nfc-intake-client";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";
import { isQrNfcSlug } from "@/lib/qr-nfc/is-qr-nfc-slug";
import { ReportWizard } from "../_components/ReportWizard";

type PageParams = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (isQrNfcSlug(slug)) {
    return {
      title: "Submit a report",
      robots: { index: false, follow: false },
      description: `Public safety report ${slug}`,
    };
  }
  return {
    title: `Request Assistance | ${slug.toUpperCase()}`,
    robots: { index: false, follow: false },
  };
}

async function engageQrCode(qrId: string, medium: ReportMedium): Promise<QRNFCPublicRecord | { active: false } | null> {
  const base = resolveUpstreamApiBase(`/api/qr-nfc/${qrId}/engage`);
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/qr-nfc/${encodeURIComponent(qrId)}/engage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medium }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as QRNFCPublicRecord | { active: false };
  } catch {
    return null;
  }
}

function inactiveReportMessage() {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-800">This reporting link is no longer active.</h1>
      <p className="mt-3 max-w-sm text-sm text-slate-500">
        Please contact security directly or call 911 for emergencies.
      </p>
    </section>
  );
}

export default async function ReportSlugPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<{ medium?: string }>;
}) {
  const { slug } = await params;

  if (!isQrNfcSlug(slug)) {
    return (
      <ReportWizard
        initialVenueCode={slug.toUpperCase()}
        initialZoneCode=""
        initialZoneLabel=""
      />
    );
  }

  const sp = await searchParams;
  const mediumRaw = sp.medium?.trim().toLowerCase();
  const medium: ReportMedium =
    mediumRaw === "nfc" || mediumRaw === "qr" || mediumRaw === "url" || mediumRaw === "direct"
      ? mediumRaw
      : "direct";

  const engaged = await engageQrCode(slug, medium);
  if (!engaged) return inactiveReportMessage();

  if ("active" in engaged && engaged.active === false) {
    return (
      <>
        <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
          <p className="text-4xl" aria-hidden>
            🔒
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-800">This reporting link is no longer active.</h1>
          <p className="mt-3 max-w-sm text-sm text-slate-500">
            Please contact security directly or call 911 for emergencies.
          </p>
          <Link href="/report/inactive" className="sr-only">
            Inactive
          </Link>
        </section>
      </>
    );
  }

  return <QRNfcIntakeClient record={engaged as QRNFCPublicRecord} medium={medium} />;
}

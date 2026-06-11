import type { Metadata } from "next";
import type { QRNFCPublicRecord, ReportMedium } from "rapid-cortex-shared";
import { QRNfcIntakeClient } from "@/components/qr-nfc/qr-nfc-intake-client";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";
import Link from "next/link";

type PageParams = { qrId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { qrId } = await params;
  return {
    title: "Submit a report",
    robots: { index: false, follow: false },
    description: `Public safety report ${qrId}`,
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

export default async function ReportQrPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<{ medium?: string }>;
}) {
  const { qrId } = await params;
  const sp = await searchParams;
  const mediumRaw = sp.medium?.trim().toLowerCase();
  const medium: ReportMedium =
    mediumRaw === "nfc" || mediumRaw === "qr" || mediumRaw === "url" || mediumRaw === "direct"
      ? mediumRaw
      : "direct";

  const engaged = await engageQrCode(qrId, medium);
  if (!engaged) {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold text-slate-800">This reporting link is no longer active.</h1>
        <p className="mt-3 max-w-sm text-sm text-slate-500">
          Please contact security directly or call 911 for emergencies.
        </p>
      </section>
    );
  }

  if ("active" in engaged && engaged.active === false) {
    return (
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
    );
  }

  return <QRNfcIntakeClient record={engaged as QRNFCPublicRecord} medium={medium} />;
}

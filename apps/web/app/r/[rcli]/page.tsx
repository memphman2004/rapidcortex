import type { Metadata } from "next";
import type { QRLocationPublic } from "rapid-cortex-shared";
import { isValidRCLI } from "rapid-cortex-shared";
import { QRIntakeClient } from "@/components/intake/QRIntakeClient";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

type PageParams = { rcli: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { rcli } = await params;
  return {
    title: "Report an incident",
    robots: { index: false, follow: false },
    description: `Safety report for ${rcli.toUpperCase()}`,
  };
}

async function resolveLocation(rcli: string): Promise<QRLocationPublic | null> {
  const normalized = rcli.trim().toUpperCase();
  if (!isValidRCLI(normalized)) return null;
  const base = resolveUpstreamApiBase(`/api/r/${normalized}`);
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/r/${encodeURIComponent(normalized)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as QRLocationPublic;
  } catch {
    return null;
  }
}

export default async function QRIntakePage({ params }: { params: Promise<PageParams> }) {
  const { rcli: rcliParam } = await params;
  const rcli = rcliParam.trim().toUpperCase();
  const location = await resolveLocation(rcli);

  if (!location) {
    return (
      <section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-semibold text-slate-800">This QR code is no longer active</h1>
        <p className="mt-3 max-w-sm text-sm text-slate-500">
          The location linked to this code could not be found. Please contact venue or campus staff for
          assistance, or call 911 in an emergency.
        </p>
      </section>
    );
  }

  return <QRIntakeClient rcli={rcli} location={location} />;
}

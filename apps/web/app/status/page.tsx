import type { Metadata } from "next";
import { StatusPageClient } from "@/components/status/status-page-client";
import { getPublicStatusPayload } from "@/lib/rapid-cortex/status/public-status-payload";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Status | Rapid Cortex Service Health",
  description:
    "View public Rapid Cortex service status, uptime updates, and operational incident history for emergency communications platform services.",
  path: "/status",
});

export default function StatusPage() {
  const initial = getPublicStatusPayload();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <StatusPageClient initial={initial} />
    </main>
  );
}

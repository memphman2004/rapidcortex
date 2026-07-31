import type { Metadata } from "next";
import { Suspense } from "react";
import { absoluteUrl } from "@/lib/seo";
import { RingLinkClient } from "./ring-link-client";

export const metadata: Metadata = {
  title: "Finish connecting Ring™ | Rapid Cortex Connect",
  description:
    "Ring™ Device Owners: sign in with your Rapid Cortex device-owner account to finish Appstore linking. Not dispatcher login.",
  robots: { index: false, follow: false },
  alternates: { canonical: absoluteUrl("/connect/ring/link") },
};

export default function RingConnectLinkPage() {
  return (
    <Suspense
      fallback={
        <article className="mx-auto max-w-lg px-4 py-16 text-sm text-slate-400 sm:px-6">
          Loading Ring™ connection status…
        </article>
      }
    >
      <RingLinkClient />
    </Suspense>
  );
}

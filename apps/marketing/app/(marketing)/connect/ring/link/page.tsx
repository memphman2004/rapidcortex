import type { Metadata } from "next";
import { Suspense } from "react";
import { absoluteUrl } from "@/lib/seo";
import { RingLinkClient } from "./ring-link-client";

export const metadata: Metadata = {
  title: "Ring account linking | Rapid Cortex Connect",
  description:
    "Complete Ring camera account linking for Rapid Cortex Connect. Sign in to manage Ring devices from the dispatcher Media workspace.",
  robots: { index: false, follow: false },
  alternates: { canonical: absoluteUrl("/connect/ring/link") },
};

export default function RingConnectLinkPage() {
  return (
    <Suspense
      fallback={
        <article className="mx-auto max-w-lg px-4 py-16 text-sm text-slate-400 sm:px-6">
          Loading Ring connection status…
        </article>
      }
    >
      <RingLinkClient />
    </Suspense>
  );
}

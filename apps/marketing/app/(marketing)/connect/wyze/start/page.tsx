import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { absoluteUrl } from "@/lib/seo";
import { WyzeConnectFlow } from "./wyze-connect-flow";

export const metadata: Metadata = {
  title: "Wyze cameras | NexiQ Vision™",
  description:
    "Register Wyze cameras with NexCort iQ for consent-gated emergency live video. You approve every request by SMS.",
  alternates: { canonical: absoluteUrl("/connect/wyze/start") },
};

export default function WyzeConnectStartPage() {
  return (
    <MarketingArticleShell eyebrow="NexiQ Vision™" title="Wyze Connect" sectionLabel="Connect">
      <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
        <WyzeConnectFlow />
      </Suspense>
    </MarketingArticleShell>
  );
}

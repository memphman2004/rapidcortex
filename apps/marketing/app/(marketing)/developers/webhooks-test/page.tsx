import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { RC_LITE_WEBHOOK_EVENTS } from "rapid-cortex-shared";

export const metadata = {
  title: "RC Lite webhook lab",
};

export default function DevelopersWebhookSandboxPage() {
  return (
    <MarketingArticleShell eyebrow="Realtime" title="Webhook signature lab" sectionLabel="Docs">
      <p className="leading-relaxed text-slate-200">
        Signing secrets never ship to browsers. Your integration validates delivery using the exported Node helper{" "}
        <code className="rounded bg-black/65 px-1 py-0.5 text-[12px] text-emerald-200">verifyRcLiteWebhookSignature</code> paired
        with KMS-stored webhook secrets mirrored per tenant. Production workers emit{" "}
        <code>X-RapidCortex-Timestamp</code> plus comma-delimited signatures (dual-signature tolerant parsing).
      </p>
      <section className="mt-12 space-y-4 rounded-3xl border border-white/15 bg-black/55 p-6 text-sm leading-relaxed text-slate-300">
        <h2 className="text-xl font-semibold text-white">Event catalog</h2>
        <ul className="list-disc space-y-2 pl-5">
          {RC_LITE_WEBHOOK_EVENTS.map((evt) => (
            <li key={evt} className="font-mono text-xs text-emerald-200">
              {evt}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10 space-y-4 rounded-3xl border border-dashed border-sky-600/55 bg-black/65 p-6 text-sm leading-relaxed text-slate-200">
        <h2 className="text-xl font-semibold text-white">Retry-aware delivery semantics</h2>
        <p>
          Delivery workers SHOULD implement exponential backoff, delivery logs keyed by webhook attempt ID, hashed payload
          archives, replay protection with monotonic timestamps, and optional dead-letter channels for SLA breach escalations —
          scaffolding exists in infra tickets; see Trust Center disclosures for SLA riders.
        </p>
      </section>
      <Link href="/developers/docs/webhooks" className="mt-14 inline-flex text-xs text-sky-400 hover:text-white">
        ← Canonical webhook docs
      </Link>
    </MarketingArticleShell>
  );
}

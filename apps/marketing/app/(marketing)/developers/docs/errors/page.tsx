import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { RC_LITE_ERROR_CATALOG } from "rapid-cortex-shared";

export const metadata = {
  title: "RC Lite API — Error catalogue",
};

export default function DevelopersErrorCatalogPage() {
  return (
    <MarketingArticleShell eyebrow="Diagnostics" title="Structured error envelopes" sectionLabel="Docs">
      <p className="leading-relaxed text-slate-300">
        Every RC Lite HTTPS response uses the same disciplined envelope pattern as mainstream REST APIs: deterministic{" "}
        <code className="text-sky-200">code</code>, human{" "}
        <code className="text-sky-200">message</code>, <code className="text-sky-200">retryable</code> guidance, propagated{" "}
        <code className="text-sky-200">requestId</code>, optional <code className="text-sky-200">details</code>, plus deep-linked{" "}
        <code className="text-sky-200">docsUrl</code> anchors (mirrored below for offline quoting).
      </p>
      <dl className="mt-12 space-y-8 text-sm text-slate-200">
        {RC_LITE_ERROR_CATALOG.map((row) => (
          <div key={row.slug}>
            <dt id={row.slug} className="scroll-mt-36 text-base font-semibold text-white">
              {row.title}{" "}
              <span className="font-mono text-[11px] font-normal uppercase tracking-[0.2em] text-emerald-200">
                [{row.slug}]
              </span>
            </dt>
            <dd className="mt-3 space-y-2 text-slate-400">
              <p>{row.description}</p>
              <p className="text-xs">
                Retry guidance:{" "}
                <span className={`font-semibold ${row.defaultRetryable ? "text-emerald-300" : "text-orange-300"}`}>
                  {row.defaultRetryable ? "Eligible for exponential backoff retries" : "Fix payload/root cause first"}
                </span>
              </p>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-14 text-xs text-slate-500">
        Operational teams may expand this catalogue with CAD adapter-specific codes (prefixed{" "}
        <code>CAD_EXPORT_*</code>) — keep machine-readable enums synchronized with Dynamo audit exports.
      </p>
      <Link href="/developers/docs" className="inline-flex pt-12 text-xs text-slate-400 hover:text-white">
        ← Documentation hub
      </Link>
    </MarketingArticleShell>
  );
}

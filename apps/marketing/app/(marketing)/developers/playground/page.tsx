import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { RcLiteApiPlayground } from "@/components/developers/rc-lite-playground";

export const metadata = {
  title: "RC Lite — Interactive API playground",
  description:
    "Browser-based sandbox playground for invoking `/api/v1` routes without external SDKs (uses same-origin fetch + sandbox keys only).",
};

export default function DevelopersPlaygroundPage() {
  return (
    <MarketingArticleShell eyebrow="Docs" title="Interactive API playground" sectionLabel="Developers">
      <p className="leading-relaxed text-slate-100">
        This console calls your deployment directly from the browser via <code className="text-sky-200">fetch</code> — no CDN
        bundling required — so CSP policies remain tight. Sandbox credentials are scoped for demos without
        production CAD export or billed usage.
      </p>
      <div className="mt-10 flex flex-wrap gap-6 text-xs text-slate-400">
        <Link className="text-sky-300 hover:text-sky-200" href="/openapi/rc-lite-v1.openapi.yaml">
          Download OpenAPI
        </Link>
        <Link className="text-sky-300 hover:text-sky-200" href="/postman/rc-lite-v1.postman_collection.json">
          Download Postman
        </Link>
        <Link className="text-sky-300 hover:text-sky-200" href="/samples/rc-lite/incident-analyze.sample.json">
          Incident sample payload
        </Link>
        <Link className="text-sky-300 hover:text-sky-200" href="/developers/docs/errors">
          Error catalogue
        </Link>
      </div>
      <RcLiteApiPlayground />
      <Link href="/developers" className="mt-10 inline-flex text-xs text-slate-400 hover:text-white">
        ← Developers hub
      </Link>
    </MarketingArticleShell>
  );
}

import Link from "next/link";

export const metadata = { title: "RC Lite — docs", robots: { index: false, follow: false } };

export default function RcLitePortalDocsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Documentation</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Operational documentation aligns with developer guides for the Rapid Cortex Agency REST API.
      </p>
      <Link className="mt-4 inline-flex text-sm text-sky-400 hover:text-sky-300" href="/developers/api">
        Open developer portal →
      </Link>
    </div>
  );
}

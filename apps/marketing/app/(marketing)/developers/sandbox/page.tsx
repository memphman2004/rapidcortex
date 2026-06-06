import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";

export const metadata = { title: "RC Lite — Sandbox" };

export default function DevelopersSandboxPage() {
  return (
    <MarketingArticleShell eyebrow="Sandbox" title="Sandbox access" sectionLabel="Developers">
      <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-300">
        <li>Sandbox keys start with deterministic prefixes (<span className="font-mono text-[13px]">rk_test_*</span> in developer environments).</li>
        <li>Sandbox metering never bills production SKU lines — separate tenant namespace.</li>
        <li>CAD exports are blocked from production egress while on sandbox entitlement.</li>
      </ul>
      <Link href="/developers" className="mt-10 inline-flex text-sm text-sky-400 hover:text-sky-300">
        ← Developers hub
      </Link>
    </MarketingArticleShell>
  );
}

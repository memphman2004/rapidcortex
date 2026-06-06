import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { marketingOperationsStatusPath } from "@/lib/marketing-links";

export const metadata = { title: "RC Lite — Status" };

export default function DevelopersStatusPage() {
  const status = marketingOperationsStatusPath();

  return (
    <MarketingArticleShell eyebrow="Operations" title="Developer status" sectionLabel="Developers">
      <p className="leading-relaxed text-slate-300">
        Automated partner feed wiring is optional. When you are ready, connect an approved external status page or health
        summary that your customers already trust.
      </p>
      <p className="mt-4 leading-relaxed text-slate-300">
        Public operational status for Rapid Cortex services:{" "}
        <Link href={status} className="font-medium text-sky-400 hover:text-sky-300">
          System status
        </Link>
        .
      </p>
      <Link href="/developers" className="mt-10 inline-flex text-sm text-sky-400 hover:text-sky-300">
        ← Developers hub
      </Link>
    </MarketingArticleShell>
  );
}

import Link from "next/link";
import { formatIssueMonth, getNextIssue, issueLabel } from "@/lib/newsletter/newsletter-data";

export function NextIssueBanner() {
  const next = getNextIssue();
  if (!next) return null;

  return (
    <div
      className="sticky top-0 z-30 border-b border-teal-800/50 px-4 py-3 text-sm text-teal-50"
      style={{ background: "rgba(0, 105, 92, 0.92)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">Coming Next Month:</span>{" "}
          <Link href={`/newsletter/${next.slug}`} className="underline-offset-2 hover:underline">
            {issueLabel(next)}
          </Link>
        </p>
        <span className="rounded-full bg-black/20 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider">
          {formatIssueMonth(next.publishDate)}
        </span>
      </div>
    </div>
  );
}

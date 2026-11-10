import Link from "next/link";
import {
  VERTICAL_COLORS,
  VERTICAL_LABELS,
  formatIssueMonth,
  type NewsletterIssue,
} from "@/lib/newsletter/newsletter-data";

export function IssueCard({ issue }: { issue: NewsletterIssue }) {
  const holiday = Boolean(issue.isHolidayIssue);
  const border = holiday ? "#F59E0B" : "#C62828";

  return (
    <article
      className="flex flex-col rounded-lg border border-slate-800 bg-slate-900 p-6"
      style={{ borderLeftWidth: 4, borderLeftColor: border }}
    >
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
        <span>
          Vol. {issue.volume}, No. {issue.issue}
        </span>
        <span aria-hidden>·</span>
        <span>{formatIssueMonth(issue.publishDate)}</span>
        {holiday ? (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-300">❄ Holiday</span>
        ) : null}
      </div>

      <h2 className="mt-3 text-xl font-semibold text-white">
        <Link href={`/newsletter/${issue.slug}`} className="hover:text-sky-300">
          {issue.title}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-slate-400">{issue.subtitle}</p>
      <p className="mt-3 text-sm text-slate-300">
        <span className="font-medium text-slate-200">Spotlight:</span> {issue.featureSpotlight}
      </p>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {issue.featuredVerticals.map((v) => (
          <li
            key={v}
            className="rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white"
            style={{ background: VERTICAL_COLORS[v] }}
          >
            {VERTICAL_LABELS[v]}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/newsletter/${issue.slug}`}
          className="text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          Read This Issue →
        </Link>
        {issue.pdfUrl ? (
          <a
            href={issue.pdfUrl}
            className="text-sm font-medium text-slate-400 hover:text-slate-200"
          >
            Download PDF ↓
          </a>
        ) : null}
      </div>
    </article>
  );
}

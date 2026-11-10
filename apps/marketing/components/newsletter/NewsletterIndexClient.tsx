"use client";

import { useMemo, useState } from "react";
import {
  formatIssueMonth,
  getPublishedIssues,
  getUpcomingIssues,
  sortIssuesForVertical,
} from "@/lib/newsletter/newsletter-data";
import { VerticalFilterTabs, type VerticalFilter } from "./VerticalFilterTabs";
import { IssueCard } from "./IssueCard";
import { IssueDropdown } from "./IssueDropdown";
import { SubscribeForm } from "./SubscribeForm";

export function NewsletterIndexClient() {
  const [filter, setFilter] = useState<VerticalFilter>("all");
  const published = useMemo(() => getPublishedIssues(), []);
  const upcoming = useMemo(() => getUpcomingIssues(), []);
  const filtered = useMemo(
    () => sortIssuesForVertical(published, filter),
    [published, filter],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-12 md:py-16">
      <VerticalFilterTabs value={filter} onChange={setFilter} />

      <div className="sticky top-14 z-20 rounded-lg border border-slate-800 bg-slate-950/95 p-3 backdrop-blur">
        <IssueDropdown />
      </div>

      <section aria-label="Published issues">
        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map((issue) => (
            <IssueCard key={issue.slug} issue={issue} />
          ))}
        </div>
      </section>

      {upcoming.length > 0 ? (
        <section aria-label="What's coming">
          <h2 className="font-mono text-xs uppercase tracking-wider text-slate-500">
            What&apos;s Coming
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {upcoming.slice(0, 6).map((issue) => (
              <li
                key={issue.slug}
                className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 px-4 py-3"
              >
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Vol. {issue.volume}, No. {issue.issue} · {formatIssueMonth(issue.publishDate)}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-200">{issue.title}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SubscribeForm />
    </div>
  );
}

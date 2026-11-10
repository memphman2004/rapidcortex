"use client";

import { useRouter } from "next/navigation";
import { NEWSLETTER_ISSUES, issueLabel } from "@/lib/newsletter/newsletter-data";

export function IssueDropdown({ currentSlug }: { currentSlug?: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="issue-jump" className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
        Jump to Issue
      </label>
      <select
        id="issue-jump"
        value={currentSlug ?? ""}
        onChange={(e) => {
          const slug = e.target.value;
          if (slug) router.push(`/newsletter/${slug}`);
        }}
        className="max-w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500/60 focus:outline-none"
      >
        <option value="" disabled>
          Select an issue…
        </option>
        {NEWSLETTER_ISSUES.map((issue) => (
          <option
            key={issue.slug}
            value={issue.slug}
            disabled={issue.status === "upcoming"}
          >
            {issueLabel(issue)}
            {issue.status === "upcoming" ? " (Coming Soon)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

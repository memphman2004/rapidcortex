"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { fetchStaffGuideArticle } from "@/lib/staff-guide/fetch-article";
import {
  STAFF_GUIDE_ACCESS,
  findStaffGuideArticle,
  flattenStaffGuideArticles,
  getStaffGuideIndex,
  positionForRole,
  type StaffGuideArticle,
  type StaffGuideVertical,
} from "@/lib/staff-guide/catalog";

const VERTICAL_LABEL: Record<StaffGuideVertical, string> = {
  campus: "Campus Safety",
  venue: "Venue Operations",
  transit: "Transit Operations",
};

export function StaffGuidePortal({
  vertical,
  role,
  basePath,
}: {
  vertical: StaffGuideVertical;
  role: string;
  basePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const index = getStaffGuideIndex(vertical);
  const yourPosition = positionForRole(vertical, role);
  const requested = searchParams.get("topic") || yourPosition?.topic || "overview";
  const active = findStaffGuideArticle(vertical, requested) ?? findStaffGuideArticle(vertical, "overview");
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index;
    return index
      .map((section) => ({
        ...section,
        articles: section.articles.filter(
          (article) =>
            article.title.toLowerCase().includes(q) ||
            article.description.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.articles.length > 0);
  }, [index, query]);

  useEffect(() => {
    if (!active) {
      setHtml(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchStaffGuideArticle(vertical, active.topic).then((result) => {
      if (cancelled) return;
      setHtml(result?.html ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vertical, active?.topic]);

  function openArticle(article: StaffGuideArticle) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("topic", article.topic);
    router.replace(`${pathname ?? basePath}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <header
        className="rounded-xl border px-5 py-4"
        style={{
          borderColor: "var(--rc-vertical-accent-border, #334155)",
          background: "var(--rc-vertical-accent-dim, rgba(148,163,184,0.08))",
        }}
      >
        <p
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--rc-vertical-accent, #94a3b8)" }}
        >
          <GraduationCap size={14} />
          Staff Guide · {VERTICAL_LABEL[vertical]}
        </p>
        <h1 className="mt-1 text-2xl font-bold" style={{ color: "var(--rc-text-primary)" }}>
          Knowledge base and onboarding
        </h1>
        <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--rc-text-muted)" }}>
          Ongoing staff reference for this vertical. This is not the 911 Help tab used on PSAP
          dispatch consoles.
        </p>
        <p
          className="mt-3 rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--rc-border)",
            background: "var(--rc-surface)",
            color: "var(--rc-text-primary)",
          }}
        >
          <strong>{STAFF_GUIDE_ACCESS.headline}.</strong> {STAFF_GUIDE_ACCESS.message}
        </p>
        {yourPosition ? (
          <p className="mt-2 text-sm" style={{ color: "var(--rc-text-secondary)" }}>
            Your position: <strong>{yourPosition.title}</strong>. You can still read every other
            position in this vertical.
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <aside
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface)" }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this guide…"
            className="mb-3 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--rc-border)", color: "var(--rc-text-primary)" }}
            aria-label="Search staff guide articles"
          />
          {filtered.map((section) => (
            <div key={section.section} className="mb-3">
              <p
                className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--rc-text-muted)" }}
              >
                {section.section}
              </p>
              {section.articles.map((article) => {
                const selected = article.topic === active?.topic;
                return (
                  <button
                    key={article.topic}
                    type="button"
                    onClick={() => openArticle(article)}
                    className="mb-1 w-full rounded-md px-2 py-2 text-left"
                    style={{
                      background: selected ? "var(--rc-vertical-accent-dim, rgba(148,163,184,0.12))" : "transparent",
                      borderLeft: selected
                        ? "2px solid var(--rc-vertical-accent, #94a3b8)"
                        : "2px solid transparent",
                    }}
                  >
                    <span className="block text-sm font-semibold" style={{ color: "var(--rc-text-primary)" }}>
                      {article.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--rc-text-muted)" }}>
                      {article.description}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 ? (
            <p className="px-2 text-sm" style={{ color: "var(--rc-text-muted)" }}>
              No articles match that search. Try another term — access stays unlimited.
            </p>
          ) : null}
        </aside>

        <article
          className="rounded-xl border px-5 py-5"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface)" }}
        >
          {active ? (
            <>
              <h2 className="text-xl font-bold" style={{ color: "var(--rc-text-primary)" }}>
                {active.title}
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--rc-text-muted)" }}>
                {active.description}
              </p>
            </>
          ) : null}
          {loading ? (
            <p className="mt-6 font-mono text-sm" style={{ color: "var(--rc-text-muted)" }}>
              Loading…
            </p>
          ) : null}
          {!loading && html ? (
            <div
              className="staff-guide-prose mt-6 space-y-3 text-sm leading-relaxed [&_a]:text-sky-400 [&_code]:rounded [&_code]:bg-slate-950 [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:text-slate-200 [&_strong]:text-white"
              style={{ color: "var(--rc-text-primary)" }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}
          {!loading && !html ? (
            <p className="mt-6 text-sm" style={{ color: "var(--rc-text-muted)" }}>
              This article is not on disk yet. Contact{" "}
              <a href="mailto:support@rapidcortex.com" className="text-sky-400">
                support@rapidcortex.com
              </a>
              .
            </p>
          ) : null}
        </article>
      </div>
      <p className="text-xs" style={{ color: "var(--rc-text-muted)" }}>
        {flattenStaffGuideArticles(vertical).length} articles in this vertical · unlimited views
      </p>
    </div>
  );
}

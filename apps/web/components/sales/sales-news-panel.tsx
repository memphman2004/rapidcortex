"use client";

import { useEffect, useMemo, useState } from "react";
import { ownersForState, type TerritoryOwner } from "@/lib/sales/territory-roster";

type NewsVertical = "911" | "campus" | "venue" | "law-enforcement" | "fire-ems" | "govtech" | "general" | "all";

type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceUrl: string;
  vertical: Exclude<NewsVertical, "all">;
  publishedAt: string;
  summary: string;
};

const FILTERS: { id: NewsVertical; label: string }[] = [
  { id: "all", label: "All" },
  { id: "911", label: "911" },
  { id: "campus", label: "Campus" },
  { id: "venue", label: "Venue" },
  { id: "law-enforcement", label: "Law" },
  { id: "fire-ems", label: "Fire/EMS" },
  { id: "govtech", label: "GovTech" },
  { id: "general", label: "General" },
];

function guessStateFromText(text: string): string | null {
  const m = text.match(/\b([A-Z]{2})\b/);
  return m?.[1] ?? null;
}

export function SalesNewsPanel() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<NewsVertical>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/sales/news", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load news");
        const data = (await res.json()) as { items?: NewsItem[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        if (!cancelled) setError("Unable to load news feeds. Try again shortly.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.vertical === filter)),
    [items, filter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={[
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
              filter === f.id
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-white/10 text-slate-500",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading && <p className="text-sm text-slate-500">Loading feeds…</p>}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-2">
        {visible.map((item) => {
          const stateGuess = guessStateFromText(`${item.title} ${item.summary}`);
          const owners: TerritoryOwner[] = stateGuess ? ownersForState(stateGuess) : [];
          return (
            <article
              key={item.id}
              className="rounded-xl border border-white/5 bg-[#0a1628] px-4 py-3"
            >
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-sky-300 hover:underline"
              >
                {item.title}
              </a>
              <p className="mt-1 text-[11px] text-slate-500">
                {item.source} · {item.vertical} ·{" "}
                {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "—"}
              </p>
              {item.summary && (
                <p className="mt-2 line-clamp-2 text-xs text-slate-400">{item.summary}</p>
              )}
              {owners.length > 0 && (
                <p className="mt-2 text-[11px] text-emerald-400/90">
                  Region owner{owners.length > 1 ? "s" : ""} ({stateGuess}):{" "}
                  {owners.map((o) => o.name).join(", ")} —{" "}
                  <a className="underline" href={`mailto:${owners[0]?.email}`}>
                    notify
                  </a>
                </p>
              )}
            </article>
          );
        })}
        {!loading && !error && visible.length === 0 && (
          <p className="text-sm text-slate-500">No stories for this filter.</p>
        )}
      </div>
    </div>
  );
}

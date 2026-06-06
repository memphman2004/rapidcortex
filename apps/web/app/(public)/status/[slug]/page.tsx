"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PublicStakeholderStatusView } from "rapid-cortex-shared";
import { fetchPublicStakeholderStatus } from "@/lib/stakeholder-api";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function PublicStakeholderStatusPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [password, setPassword] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(undefined);
  const [needsPassword, setNeedsPassword] = useState(false);

  const q = useQuery({
    queryKey: ["public-stakeholder", slug, submittedPassword ?? ""],
    queryFn: () => fetchPublicStakeholderStatus(slug, submittedPassword),
    enabled: Boolean(slug),
    refetchInterval: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (q.error instanceof Error && q.error.message.toLowerCase().includes("password")) {
      setNeedsPassword(true);
    }
  }, [q.error]);

  const data = q.data as PublicStakeholderStatusView | undefined;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Incident status</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {data?.title ?? (q.isLoading ? "Loading…" : "Status update")}
          </h1>
          {data?.lastUpdatedAt ? (
            <p className="mt-2 text-sm text-slate-600">Last updated {formatWhen(data.lastUpdatedAt)}</p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {needsPassword && !submittedPassword ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-700">This page is password protected.</p>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Page password"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setSubmittedPassword(password)}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                View
              </button>
            </div>
          </section>
        ) : null}

        {q.isError && !needsPassword ? (
          <p className="text-sm text-red-700">{q.error instanceof Error ? q.error.message : "Unable to load page"}</p>
        ) : null}

        {data?.summary ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Summary</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.summary}</p>
          </section>
        ) : null}

        {data?.timeline && data.timeline.length > 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Timeline</h2>
            <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4">
              {data.timeline.map((item) => (
                <li key={`${item.timestamp}-${item.label}`} className="relative">
                  <span className="absolute -left-[1.35rem] top-1.5 h-2 w-2 rounded-full bg-slate-400" />
                  <p className="text-xs text-slate-500">{formatWhen(item.timestamp)}</p>
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  {item.description ? (
                    <p className="text-sm text-slate-600">{item.description}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {typeof data?.unitCount === "number" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Responding units</h2>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{data.unitCount}</p>
            <p className="text-xs text-slate-500">Units assigned to this incident</p>
          </section>
        ) : null}

        {typeof data?.mediaCount === "number" && data.mediaCount > 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Media</h2>
            <p className="mt-2 text-sm text-slate-700">{data.mediaCount} verified media item(s) on file.</p>
          </section>
        ) : null}

        {data?.customSections?.map((s) => (
          <section key={s.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">{s.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{s.content}</p>
          </section>
        ))}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Powered by Rapid Cortex
      </footer>
    </div>
  );
}

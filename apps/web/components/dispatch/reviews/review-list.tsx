"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PostIncidentReview, PostIncidentReviewStatus } from "rapid-cortex-shared";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  downloadReviewExport,
  exportPostIncidentReview,
  fetchPostIncidentReviews,
  isPostIncidentReviewApiConfigured,
} from "@/lib/post-incident-review-api";
import { isPostIncidentReviewsEnabled } from "@/lib/runtime-flags";

function statusClass(s: PostIncidentReviewStatus): string {
  if (s === "final") return "bg-emerald-950/80 text-emerald-200 ring-emerald-800";
  if (s === "archived") return "bg-slate-800 text-slate-400 ring-slate-700";
  return "bg-amber-950/80 text-amber-200 ring-amber-800";
}

export function ReviewList() {
  const to = useJurisdictionLink();
  const [statusFilter, setStatusFilter] = useState<"" | PostIncidentReviewStatus>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const enabled = isPostIncidentReviewsEnabled() && isPostIncidentReviewApiConfigured();

  const q = useQuery({
    queryKey: ["post-incident-reviews", statusFilter],
    queryFn: () => fetchPostIncidentReviews(statusFilter ? { status: statusFilter } : undefined),
    enabled,
  });

  const rows = useMemo(() => {
    let items = q.data ?? [];
    if (fromDate) {
      const from = new Date(fromDate).getTime();
      items = items.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (toDate) {
      const toMs = new Date(toDate).getTime() + 86_400_000;
      items = items.filter((r) => new Date(r.createdAt).getTime() <= toMs);
    }
    return items;
  }, [q.data, fromDate, toDate]);

  const onExport = async (review: PostIncidentReview) => {
    const data = await exportPostIncidentReview(review.reviewId);
    downloadReviewExport(data);
  };

  if (!enabled) {
    return (
      <p className="text-sm text-slate-500">Post-incident reviews are disabled in this environment.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="text-slate-400">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | PostIncidentReviewStatus)}
            className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-slate-400">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
          />
        </label>
        <label className="text-slate-400">
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-950/80 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Incident</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Reviewer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {q.isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : null}
            {rows.length === 0 && !q.isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-slate-500">
                  No reviews match filters.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.reviewId} className="hover:bg-slate-900/50">
                <td className="px-3 py-2 font-mono text-xs">{r.incidentId}</td>
                <td className="px-3 py-2 text-xs text-slate-400">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.reviewedBy.slice(0, 10)}…</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${statusClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Link
                      href={to(`/reviews/${encodeURIComponent(r.reviewId)}`)}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Open
                    </Link>
                    {r.status === "final" || r.status === "archived" ? (
                      <button
                        type="button"
                        onClick={() => void onExport(r)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        Export
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

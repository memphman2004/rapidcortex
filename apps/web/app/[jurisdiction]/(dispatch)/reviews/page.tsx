"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isSupervisorOrAdmin } from "rapid-cortex-security";
import { useSession } from "@/components/auth/session-context";
import { ReviewList } from "@/components/dispatch/reviews/review-list";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { createPostIncidentReview, isPostIncidentReviewApiConfigured } from "@/lib/post-incident-review-api";
import { isPostIncidentReviewsEnabled } from "@/lib/runtime-flags";

export default function ReviewsPage() {
  const { user } = useSession();
  const router = useRouter();
  const to = useJurisdictionLink();
  const [incidentId, setIncidentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = user ? isSupervisorOrAdmin(user.role) : false;
  const enabled = isPostIncidentReviewsEnabled() && isPostIncidentReviewApiConfigured();

  const create = async () => {
    if (!incidentId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const review = await createPostIncidentReview({ incidentId: incidentId.trim() });
      router.push(to(`/reviews/${encodeURIComponent(review.reviewId)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Post-incident reviews</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Formal after-action documents linked to timeline events and QA scorecards.
        </p>
      </div>

      {enabled && canCreate ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <label className="text-xs text-slate-400">
            New review for incident
            <input
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              placeholder="incident id"
              className="mt-1 block w-64 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="rounded bg-sky-900/60 px-3 py-1.5 text-xs font-medium text-sky-100 ring-1 ring-sky-800 disabled:opacity-40"
          >
            Create review
          </button>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
      ) : null}

      <ReviewList />

      <p className="text-xs text-slate-600">
        <Link href={to("/review")} className="text-sky-500 hover:underline">
          Supervisor overview
        </Link>
      </p>
    </div>
  );
}

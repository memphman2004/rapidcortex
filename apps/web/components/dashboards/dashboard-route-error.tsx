"use client";

import { useEffect } from "react";

/** Segment error UI for role dashboards — avoids bubbling to Next.js global-error. */
export default function DashboardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-white">This workspace could not load</h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        {error.digest
          ? "A server error occurred while loading this page."
          : "Something went wrong while rendering this page. Try again or return to your dashboard home."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/";
            }
          }}
          className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Back
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";

/** Root fallback when middleware or RSC rendering fails (Next.js 16 global error UI). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-[#030712] px-6 py-16 text-center text-slate-100">
        <div className="max-w-md space-y-4">
          <h1 className="text-lg font-semibold">This workspace could not load</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            {error.digest
              ? "A server error occurred while loading this page. Try a full reload, or sign in again."
              : "Something went wrong while loading Rapid Cortex. A full page reload usually fixes this after sign-in."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Try again
            </button>
            <a
              href="/login"
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Sign in
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

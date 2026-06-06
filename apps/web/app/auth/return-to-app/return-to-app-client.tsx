"use client";

import { useEffect, useMemo } from "react";

const DEFAULT_RETURN_URI = "rapidcortex://oauth/callback";

export function ReturnToAppClient({ code, state }: { code?: string; state?: string }) {
  const deepLink = useMemo(() => {
    const u = new URL(DEFAULT_RETURN_URI);
    const codeValue = code?.trim();
    const stateValue = state?.trim();
    if (codeValue) u.searchParams.set("code", codeValue);
    if (stateValue) u.searchParams.set("state", stateValue);
    return u.toString();
  }, [code, state]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.location.href = deepLink;
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [deepLink]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-slate-100">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Rapid Cortex</h1>
        <p className="mt-3 text-sm text-slate-300">
          You are signed in. Return to Rapid Cortex to continue.
        </p>
        <a
          href={deepLink}
          className="mt-6 inline-flex rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Open Rapid Cortex
        </a>
        <p className="mt-4 text-xs text-slate-400">
          If the app does not open automatically, click the button above. If you do not have Rapid
          Cortex installed, contact your agency administrator.
        </p>
      </div>
    </main>
  );
}

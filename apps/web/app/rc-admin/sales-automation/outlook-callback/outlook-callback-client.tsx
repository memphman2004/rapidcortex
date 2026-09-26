"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeOutlookConnect } from "@/lib/rapid-iq/sales-automation-api";

export function OutlookCallbackClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = search.get("error_description") || search.get("error");
    if (oauthError) {
      setError(oauthError);
      return;
    }
    const code = search.get("code")?.trim();
    const state = search.get("state")?.trim();
    if (!code || !state) {
      setError("Microsoft did not return an authorization code.");
      return;
    }
    let cancelled = false;
    void completeOutlookConnect(code, state)
      .then(() => {
        if (!cancelled) router.replace("/rc-admin/sales-automation?outlook=connected");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Outlook connect failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router, search]);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#050c1a] px-6 py-10 text-sm text-slate-300">
      {error ? (
        <>
          <p className="text-red-300">{error}</p>
          <p className="mt-2 text-slate-500">
            Sign in as hello@nexcortiq.us, not your personal NexCort iQ mailbox.
          </p>
          <a href="/rc-admin/sales-automation" className="mt-4 inline-block text-sky-400">
            Back to Sales Automation
          </a>
        </>
      ) : (
        <p>Connecting hello@nexcortiq.us…</p>
      )}
    </div>
  );
}

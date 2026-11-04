"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SalesOutlookCallbackClient() {
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
    void fetch("/api/sales/outlook/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        const json: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof json === "object" &&
            json &&
            "error" in json &&
            typeof (json as { error: unknown }).error === "string"
              ? (json as { error: string }).error
              : `Outlook connect failed (${res.status})`;
          throw new Error(msg);
        }
        if (!cancelled) router.replace("/sales?tab=sales-tools&outlook=connected");
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
            Sign in with your @nexcortiq.us mailbox — other domains are not allowed.
          </p>
          <a href="/sales?tab=sales-tools" className="mt-4 inline-block text-sky-400">
            Back to Sales Tools
          </a>
        </>
      ) : (
        <p>Connecting your @nexcortiq.us Outlook…</p>
      )}
    </div>
  );
}

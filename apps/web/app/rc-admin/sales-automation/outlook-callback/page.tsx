"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeOutlookConnect } from "@/lib/rapid-iq/sales-automation-api";

function OutlookCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Connecting Outlook…");

  useEffect(() => {
    const error = params.get("error");
    const code = params.get("code");
    const state = params.get("state");
    if (error) {
      setMessage(`Outlook declined the connection (${error}). You can close this tab and try again.`);
      return;
    }
    if (!code || !state) {
      setMessage("Missing Outlook authorization. Return to Sales Automation and connect again.");
      return;
    }
    void completeOutlookConnect(code, state)
      .then(() => {
        router.replace("/rc-admin/sales-automation?outlook=connected");
      })
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Outlook connect failed");
      });
  }, [params, router]);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#050c1a] px-6 py-10 text-sm text-slate-300">
      {message}
    </div>
  );
}

export default function SalesOutlookCallbackPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Connect Outlook</h1>
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/[0.06] bg-[#050c1a] px-6 py-10 text-sm text-slate-500">
            Connecting Outlook…
          </div>
        }
      >
        <OutlookCallbackInner />
      </Suspense>
    </div>
  );
}

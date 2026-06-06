"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/auth/session-context";
import { postAgencySopUploadUrl, isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isSopProtocolEnabled } from "@/lib/runtime-flags";

export default function AdminSopProtocolsPage() {
  const to = useJurisdictionLink();
  const { user } = useSession();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const issueUpload = async () => {
    if (!user?.agencyId) {
      setMsg("No agency in session.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const out = await postAgencySopUploadUrl(user.agencyId, {
        fileName: `sop-${Date.now()}.txt`,
        contentType: "text/plain",
      });
      setMsg(`PUT the SOP text to the presigned URL, then PATCH the agency with sop.sopDocumentS3Key = "${out.key}".`);
      window.open(out.uploadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">SOP documents</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Agency SOP text is stored under the shared assets bucket using the{" "}
          <code className="rounded bg-slate-900 px-1 text-slate-200">agency-sop/&lt;agencyId&gt;/…</code> prefix.
          Enable <code className="rounded bg-slate-900 px-1">ENABLE_SOP_PROTOCOL_AI</code> and matching{" "}
          <code className="rounded bg-slate-900 px-1">NEXT_PUBLIC_ENABLE_SOP_PROTOCOL_AI</code> for UI + transcript
          hooks.
        </p>
      </div>
      {!isSopProtocolEnabled() ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          Client flag <span className="font-mono">NEXT_PUBLIC_ENABLE_SOP_PROTOCOL_AI</span> is off — turn it on with
          the API flag to use SOP-aware protocol surfacing.
        </p>
      ) : null}
      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upload (admin)</h2>
        <p className="mt-2 text-sm text-slate-400">
          Issues a short-lived presigned PUT for your tenant. After upload, PATCH{" "}
          <span className="font-mono text-slate-300">/api/agencies/&lt;id&gt;</span> with{" "}
          <span className="font-mono text-slate-300">sop: {"{"} autoDetectEnabled, sopDocumentS3Key {"}"}</span>.
        </p>
        <button
          type="button"
          disabled={busy || !isApiConfigured() || !user}
          onClick={issueUpload}
          className="mt-3 rounded-md bg-sky-900/40 px-3 py-2 text-sm font-medium text-sky-200 ring-1 ring-sky-800 hover:bg-sky-900/60 disabled:opacity-50"
        >
          Get presigned upload URL
        </button>
        {msg ? <p className="mt-3 text-xs text-slate-300">{msg}</p> : null}
      </section>
      <p className="text-sm text-slate-400">
        <Link href={to("/admin/protocols")} className="text-sky-400 hover:underline">
          ← Protocol catalog
        </Link>
      </p>
    </div>
  );
}

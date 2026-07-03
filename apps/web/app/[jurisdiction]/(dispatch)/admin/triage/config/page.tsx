"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { fetchAgency, isApiConfigured, patchAgency } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isNonEmergencyTriageEnabled } from "@/lib/runtime-flags";

function isTriageAdmin(role: string | undefined): boolean {
  return role === "agencyadmin" || role === "agencyit" || role === "rcsuperadmin";
}

export default function AdminTriageConfigPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const [queueEnabled, setQueueEnabled] = useState(false);
  const [triageEnabled, setTriageEnabled] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const agencyQuery = useQuery({
    queryKey: ["agency", user?.agencyId],
    queryFn: () => fetchAgency(user!.agencyId),
    enabled: Boolean(user?.agencyId && isApiConfigured() && isTriageAdmin(user.role)),
  });

  useEffect(() => {
    const triage = agencyQuery.data?.config?.triage;
    setTriageEnabled(Boolean(triage?.enabled));
    setQueueEnabled(Boolean(triage?.nonEmergencyQueueEnabled));
  }, [agencyQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user?.agencyId) throw new Error("No agency in session.");
      return patchAgency(user.agencyId, {
        triage: {
          enabled: triageEnabled,
          nonEmergencyQueueEnabled: queueEnabled,
        },
      });
    },
    onSuccess: async () => {
      setSaveMessage({ tone: "ok", text: "Triage settings saved." });
      await qc.invalidateQueries({ queryKey: ["agency", user?.agencyId] });
    },
    onError: (e: Error) => {
      setSaveMessage({ tone: "error", text: e.message });
    },
  });

  if (!user) return null;

  if (!isTriageAdmin(user.role)) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-300">You do not have permission to configure triage settings.</p>
      </div>
    );
  }

  if (!isNonEmergencyTriageEnabled()) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <h1 className="text-lg font-semibold text-white">Non-emergency triage</h1>
        <p className="max-w-xl text-sm text-slate-400">
          Non-emergency triage is disabled for this web deployment. Set{" "}
          <code className="text-violet-300">NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE=1</code> and{" "}
          <code className="text-violet-300">ENABLE_NON_EMERGENCY_TRIAGE</code> on the API.
        </p>
        <Link href={to("/admin")} className="text-sm text-sky-400 hover:underline">
          ← Admin overview
        </Link>
      </div>
    );
  }

  const statusLabel =
    queueEnabled && triageEnabled ? "Enabled" : queueEnabled ? "Queue on (triage off)" : "Disabled";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400/90">Configuration</p>
        <h1 className="text-lg font-semibold text-white">Non-emergency triage</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Control AI triage and the separate non-emergency intake queue. Changes apply agency-wide.
        </p>
        <p className="mt-2 text-sm">
          <Link href={to("/admin")} className="text-sky-400 hover:underline">
            ← Admin overview
          </Link>
        </p>
      </div>

      <section className="max-w-xl rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current status</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              queueEnabled && triageEnabled
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {statusLabel}
          </span>
        </div>

        {agencyQuery.isLoading ? <p className="text-sm text-slate-500">Loading agency config…</p> : null}
        {agencyQuery.isError ? (
          <p className="text-sm text-rose-300">
            {agencyQuery.error instanceof Error ? agencyQuery.error.message : "Failed to load agency config."}
          </p>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={triageEnabled}
            onChange={(e) => {
              setSaveMessage(null);
              const next = e.target.checked;
              setTriageEnabled(next);
              if (!next) setQueueEnabled(false);
            }}
            disabled={!isApiConfigured() || saveMut.isPending}
          />
          <span>
            <span className="block text-sm font-medium text-white">Enable AI non-emergency triage</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Runs classification on transcript segments (requires API{" "}
              <code className="text-slate-400">TRIAGE_DETECT_EVERY_N_SEGMENTS</code>).
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={queueEnabled}
            onChange={(e) => {
              setSaveMessage(null);
              const next = e.target.checked;
              setQueueEnabled(next);
              if (next) setTriageEnabled(true);
            }}
            disabled={!isApiConfigured() || saveMut.isPending || !triageEnabled}
          />
          <span>
            <span className="block text-sm font-medium text-white">Enable non-emergency intake queue</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              When enabled, calls classified as non-emergency are routed to a separate DynamoDB-backed queue.
              Dispatchers see the queue tab on their console. Requires{" "}
              <code className="text-slate-400">NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE</code> on this deployment.
            </span>
          </span>
        </label>

        {saveMessage ? (
          <p className={`text-sm ${saveMessage.tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
            {saveMessage.text}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!isApiConfigured() || saveMut.isPending || agencyQuery.isLoading}
          onClick={() => {
            setSaveMessage(null);
            saveMut.mutate();
          }}
          className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {saveMut.isPending ? "Saving…" : "Save settings"}
        </button>
      </section>
    </div>
  );
}

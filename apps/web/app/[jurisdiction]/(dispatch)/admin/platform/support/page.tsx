"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchPlatformSummary } from "@/lib/api";
import type { SupportAlert } from "@/components/platform/support-alert-list";
import { SupportAlertList } from "@/components/platform/support-alert-list";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { useMemo, useState } from "react";

export default function PlatformSupportPage() {
  const to = useJurisdictionLink();
  const summaryQ = useQuery({ queryKey: ["platform", "summary"], queryFn: fetchPlatformSummary });
  const [queueNote, setQueueNote] = useState("");

  const alerts: SupportAlert[] = useMemo(() => {
    const s = summaryQ.data;
    if (!s) return [];
    const out: SupportAlert[] = [];
    if (s.totals.onboardingItemsNeedingAttention)
      out.push({
        id: "onb",
        title: "Onboarding action queue",
        detail: `${s.totals.onboardingItemsNeedingAttention} agency rows need a platform touchpoint.`,
        severity: "warning",
        action: (
          <Link className="text-sky-300 hover:underline" href={to("/admin/platform/onboarding")}>
            Pipeline
          </Link>
        ),
      });
    if (s.totals.agenciesWithOnboardingBlockers)
      out.push({
        id: "blk",
        title: "Blocked steps",
        detail: `${s.totals.agenciesWithOnboardingBlockers} have blocked steps on the internal checklist.`,
        severity: "critical",
      });
    const pr = s.integrationSnapshot.pilotReadiness;
    if (pr && pr.multilingualIssueCount > 0) {
      out.push({
        id: "i18n",
        title: "Configuration validation",
        detail: `Multilingual / STT stack reports ${pr.multilingualIssueCount} issues.`,
        severity: "warning",
        action: (
          <Link className="text-sky-300 hover:underline" href={to("/admin/platform/integrations")}>
            Integrations
          </Link>
        ),
      });
    }
    out.push({
      id: "auth-placeholder",
      title: "Auth / SMS / video triage (placeholder)",
      detail:
        "Centralized support incident indexing is not yet wired. Pull CloudWatch, Cognito, and Twilio logs for production investigations.",
      severity: "info",
    });
    return out;
  }, [summaryQ.data, to]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Support & operations</h1>
        <p className="text-sm text-slate-400">
          Internal run queue derived from live platform metrics. This does not replace customer ticketing —
          it centralizes what Rapid Cortex operators should look at first.
        </p>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase text-slate-500">Active queue (derived)</h2>
        {summaryQ.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-2">
            <SupportAlertList items={alerts} />
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 border-dashed bg-slate-900/20 p-4">
        <h2 className="text-xs font-semibold uppercase text-slate-500">Internal notes (scaffold)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ephemeral in-browser only — not persisted. Replace with a shared ops DB or ticketing link when
          ready.
        </p>
        <textarea
          className="mt-2 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
          rows={4}
          value={queueNote}
          onChange={(e) => setQueueNote(e.target.value)}
          placeholder="Shift notes, P1/P2, customer contacts…"
        />
      </section>
    </div>
  );
}

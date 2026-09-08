"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { CallAssistChrome } from "@/components/call-assist/call-assist-chrome";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { isApiConfigured } from "@/lib/api";
import { canRunCallAssistDemo } from "@/lib/call-assist/access";
import { getCallAssistDemoScenarios, runCallAssistDemo } from "@/lib/call-assist/call-assist-api";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

export default function CallAssistDemoPage() {
  const { user } = useSession();
  const { requestAgencyId, agencyId, ready } = useCallAssistConfig();
  const [selected, setSelected] = useState("");
  const allowed = canRunCallAssistDemo(user?.role);
  const enabled = Boolean(user && isApiConfigured() && isCallAssistEnabled() && allowed && ready);
  const scenariosQuery = useQuery({
    queryKey: ["call-assist-demo-scenarios", agencyId],
    queryFn: () => getCallAssistDemoScenarios(requestAgencyId),
    enabled,
  });
  const runMut = useMutation({
    mutationFn: (scenarioId: string) => runCallAssistDemo(scenarioId, requestAgencyId),
  });

  if (!user) return null;
  if (!allowed) {
    return <p className="p-6 text-sm text-rose-300">Demo runner is limited to administrators.</p>;
  }
  if (!isCallAssistEnabled()) {
    return <p className="p-6 text-sm text-slate-400">Call Assist is not enabled.</p>;
  }

  const items = (scenariosQuery.data?.items ?? []) as Array<{
    id: string;
    name: string;
    description: string;
    expectedTransferTrigger: string;
  }>;
  const result = runMut.data?.result as
    | {
        passed?: boolean;
        sessionId?: string;
        actualClassification?: string;
        actualTransferTrigger?: string;
        steps?: Array<{ sequence: number; text: string; action?: string; continueAiConversation: boolean }>;
      }
    | undefined;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <CallAssistChrome title="Call Assist demo runner" />
      <p className="max-w-2xl text-sm text-slate-400">
        Runs seeded evaluation scenarios through the live Safety, Triage, and Intake engines. Demo emergency
        transfers use the tenant test destination, never live emergency services. Requires ENABLE_CALL_ASSIST_DEMO_MODE
        on the API.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-300">
          Scenario
          <select
            className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={selected || items[0]?.id || ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
          disabled={runMut.isPending || !(selected || items[0]?.id)}
          onClick={() => {
            const id = selected || items[0]?.id;
            if (id) runMut.mutate(id);
          }}
        >
          {runMut.isPending ? "Running…" : "Run scenario"}
        </button>
      </div>
      {runMut.isError ? (
        <p className="text-sm text-rose-300">
          {(runMut.error as Error).message}. Confirm demo mode is enabled and the call-assist.module add-on is entitled.
        </p>
      ) : null}
      {result ? (
        <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-200">
          <p>
            Result: <strong>{result.passed ? "PASS" : "REVIEW"}</strong> · {result.actualClassification} ·{" "}
            {result.actualTransferTrigger} · session {result.sessionId}
          </p>
          <ol className="mt-3 space-y-2">
            {(result.steps ?? []).map((s) => (
              <li key={s.sequence}>
                <span className="text-slate-500">#{s.sequence}</span> {s.text}
                <span className="ml-2 text-xs text-slate-400">
                  {s.action ?? "CONTINUE"} · AI {s.continueAiConversation ? "on" : "stopped"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

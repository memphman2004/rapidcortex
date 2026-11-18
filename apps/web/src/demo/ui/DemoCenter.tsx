"use client";

import { useEffect, useState } from "react";
import { activateDemoSession } from "../engine/demo-mode-gate";
import { getDemoPlaybackEngine } from "../engine/DemoPlaybackEngine";
import { getScenario } from "../scenarios/registry";
import { DemoScenarioSelector } from "./DemoScenarioSelector";
import { DemoWorkspace } from "./DemoWorkspace";

export function DemoCenter({
  autostart,
  shareToken,
}: {
  autostart?: { scenarioId: string; offsetSeconds?: number; tourStop?: string };
  shareToken?: string;
}) {
  const [loadedId, setLoadedId] = useState<string | null>(autostart?.scenarioId ?? null);
  const [failed, setFailed] = useState(false);

  const scenarioId = autostart?.scenarioId;
  const offsetSeconds = autostart?.offsetSeconds ?? 0;
  const tourStop = autostart?.tourStop ?? "";

  useEffect(() => {
    activateDemoSession({
      source: shareToken ? "link" : "presenter",
      scenarioId,
      offsetSeconds,
      tourStop,
    });
    if (shareToken) {
      void fetch("/api/demo/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use", token: shareToken }),
      }).catch(() => undefined);
    }
    if (!scenarioId) return;
    const engine = getDemoPlaybackEngine();
    void engine
      .load(scenarioId)
      .then(() => {
        if (offsetSeconds > 0) engine.seek(offsetSeconds);
        if (tourStop) engine.jumpToHighlight(tourStop);
        const scenario = getScenario(scenarioId);
        if (scenario && !scenario.manualAdvance) engine.start();
        setLoadedId(scenarioId);
      })
      .catch(() => setFailed(true));
  }, [offsetSeconds, scenarioId, shareToken, tourStop]);

  if (failed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1117] px-6 text-center text-slate-200">
        <p>That scenario is not available in this demo.</p>
      </main>
    );
  }

  if (!loadedId) {
    return (
      <main className="min-h-screen bg-[#0f1117] text-slate-100">
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
            Maplewood County Communications Center
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Choose a demo</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Everything you are about to see is fictional. No live 911 center, caller, or dispatcher is connected.
          </p>
        </div>
        <DemoScenarioSelector onLoaded={setLoadedId} />
      </main>
    );
  }

  return <DemoWorkspace />;
}

"use client";

import { getDemoPlaybackEngine } from "../engine/DemoPlaybackEngine";
import { listScenarios } from "../scenarios/registry";
import type { DemoScenarioManifest } from "../types";

function minutes(seconds: number): string {
  if (seconds <= 0) return "Presenter-paced";
  const mins = Math.max(1, Math.round(seconds / 60));
  return `About ${mins} min at 1×`;
}

export function DemoScenarioSelector({
  onLoaded,
}: {
  onLoaded: (scenarioId: string) => void;
}) {
  const scenarios = listScenarios();

  const load = (scenario: DemoScenarioManifest) => {
    void getDemoPlaybackEngine()
      .load(scenario.id)
      .then(() => onLoaded(scenario.id));
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {scenarios.map((scenario) => (
        <article
          key={scenario.id}
          className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-black/20"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-400">
            {scenario.audience}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">{scenario.displayName}</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{scenario.description}</p>
          <ul className="mt-3 space-y-1 text-xs text-slate-300">
            {scenario.featureHighlights.slice(0, 4).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{minutes(scenario.estimatedDurationSeconds)}</p>
          <button
            type="button"
            onClick={() => load(scenario)}
            className="mt-4 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Load Scenario
          </button>
        </article>
      ))}
    </div>
  );
}

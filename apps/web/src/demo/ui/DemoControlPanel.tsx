"use client";

import { useEffect, useState } from "react";
import { updateCalloutCopy } from "../fixtures/callout-store";
import { getDemoPlaybackEngine } from "../engine/DemoPlaybackEngine";
import { isDemoInstance } from "../engine/demo-mode-gate";
import { usePlaybackEngine } from "../hooks/useDemoEngine";
import { listScenariosIncludingDisabled, setEventOffset, setScenarioEnabled } from "../scenarios/registry";
import { formatDemoClock } from "./format";

type PanelMode = "closed" | "open" | "presentation";

export function DemoControlPanel() {
  const snapshot = usePlaybackEngine();
  const [mode, setMode] = useState<PanelMode>("closed");
  const [scenarioId, setScenarioId] = useState(snapshot.scenarioId ?? "demo-standard");
  const [issuer, setIssuer] = useState("sales-desk");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [calloutId, setCalloutId] = useState("tour-dispatcher");
  const [calloutText, setCalloutText] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setMode((current) => (current === "closed" ? "open" : "closed"));
      }
      if (!typing && event.key === "ArrowRight") {
        getDemoPlaybackEngine().advanceHighlight();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [liveOffset, setLiveOffset] = useState(snapshot.offsetSeconds);

  useEffect(() => {
    if (snapshot.status !== "playing") {
      setLiveOffset(snapshot.offsetSeconds);
      return;
    }
    const id = window.setInterval(() => setLiveOffset(getDemoPlaybackEngine().getCurrentOffset()), 250);
    return () => window.clearInterval(id);
  }, [snapshot.status, snapshot.offsetSeconds]);

  const engine = getDemoPlaybackEngine();
  const scenarios = listScenariosIncludingDisabled();
  const tourStops = scenarios.find((item) => item.id === "demo-guided-tour")?.guidedHighlights ?? [];

  const loadSelected = () => {
    void engine.load(scenarioId).then(() => {
      if (scenarioId !== "demo-guided-tour") engine.start();
    });
  };

  const issueLink = async () => {
    setLinkError("");
    setLink("");
    const response = await fetch("/api/demo/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "issue", scenarioId, issuer, expiresInDays: 7 }),
    });
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) {
      setLinkError(body.error ?? "Link could not be created. The signing secret has to be configured.");
      return;
    }
    setLink(body.url);
  };

  if (mode === "closed") {
    return (
      <button
        type="button"
        aria-label="Open demo controls"
        onClick={() => setMode("open")}
        className="fixed top-1/2 right-0 z-[70] -translate-y-1/2 rounded-l-md border border-amber-700/50 bg-amber-950/90 px-1 py-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200 [writing-mode:vertical-rl]"
      >
        Demo
      </button>
    );
  }

  return (
    <aside className="fixed top-12 right-3 z-[70] flex max-h-[calc(100vh-4rem)] w-[min(100%-1.5rem,22rem)] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950/95 text-slate-100 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Demo controls</p>
        <div className="flex gap-2 text-[11px]">
          <button type="button" className="text-slate-400 hover:text-white" onClick={() => setMode("presentation")}>
            Minimal
          </button>
          <button type="button" className="text-slate-400 hover:text-white" onClick={() => setMode("closed")}>
            Hide
          </button>
        </div>
      </div>
      <div className="space-y-3 overflow-auto p-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold" onClick={() => (snapshot.status === "playing" ? engine.pause() : engine.start())}>
            {snapshot.status === "playing" ? "Pause" : "Play"}
          </button>
          <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => engine.reset()}>
            Reset
          </button>
          {[1, 2, 4].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => engine.setSpeed(speed)}
              className={`rounded px-2 py-1 text-xs ${snapshot.speed === speed ? "bg-amber-400 text-amber-950" : "bg-slate-800"}`}
            >
              {speed}×
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          {formatDemoClock(liveOffset)} / {formatDemoClock(snapshot.durationSeconds)} · {snapshot.status}
        </p>
        {mode === "presentation" ? (
          <button type="button" className="text-xs text-slate-400" onClick={() => setMode("open")}>
            Show full controls
          </button>
        ) : (
          <>
            <label className="block text-xs text-slate-400">
              Scenario
              <select
                value={scenarioId}
                onChange={(event) => setScenarioId(event.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
              >
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.displayName}
                    {scenario.enabled ? "" : " (hidden)"}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={loadSelected}>
              Load scenario
            </button>
            {snapshot.manualAdvance ? (
              <div className="space-y-2 rounded border border-slate-800 p-2">
                <button type="button" className="rounded bg-amber-400 px-2 py-1 text-xs font-semibold text-amber-950" onClick={() => engine.advanceHighlight()}>
                  Next highlight
                </button>
                <label className="block text-xs text-slate-400">
                  Jump to stop
                  <select
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                    onChange={(event) => engine.jumpToHighlight(event.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a stop
                    </option>
                    {tourStops.map((stop) => (
                      <option key={stop.id} value={stop.id}>
                        {stop.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Event log</p>
              <ol className="mt-1 max-h-40 space-y-1 overflow-auto font-mono text-[11px] text-slate-300">
                {snapshot.log.length === 0 ? <li className="text-slate-600">Waiting for the first event.</li> : null}
                {snapshot.log.map((entry) => (
                  <li key={entry.eventId}>
                    [{formatDemoClock(entry.offsetSeconds)}] {entry.type} — {entry.summary}
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Admin</p>
              <label className="block text-xs text-slate-400">
                Callout {calloutId}
                <input
                  value={calloutText}
                  onChange={(event) => setCalloutText(event.target.value)}
                  placeholder="Replacement sentence"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                className="rounded bg-slate-800 px-2 py-1 text-xs"
                onClick={() => updateCalloutCopy(calloutId, { description: calloutText })}
              >
                Save callout text
              </button>
              <label className="block text-xs text-slate-400">
                Enable or hide a scenario
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
                  onChange={(event) => {
                    const [id, enabled] = event.target.value.split(":");
                    if (id) setScenarioEnabled(id, enabled === "on");
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose
                  </option>
                  {scenarios.map((scenario) => (
                    <option key={`${scenario.id}-on`} value={`${scenario.id}:on`}>
                      Show {scenario.displayName}
                    </option>
                  ))}
                  {scenarios.map((scenario) => (
                    <option key={`${scenario.id}-off`} value={`${scenario.id}:off`}>
                      Hide {scenario.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded bg-slate-800 px-2 py-1 text-xs"
                onClick={() => setEventOffset(scenarioId, scenarios.find((item) => item.id === scenarioId)?.events[0]?.id ?? "", 5)}
              >
                Nudge first event to 0:05
              </button>
              <label className="block text-xs text-slate-400">
                Issuer name on the link
                <input
                  value={issuer}
                  onChange={(event) => setIssuer(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                />
              </label>
              <button type="button" className="rounded bg-sky-700 px-2 py-1 text-xs font-semibold" onClick={() => void issueLink()}>
                Create 7-day share link
              </button>
              {link ? <p className="break-all text-[11px] text-emerald-300">{link}</p> : null}
              {linkError ? <p className="text-[11px] text-amber-300">{linkError}</p> : null}
              {isDemoInstance() ? null : (
                <button
                  type="button"
                  className="text-xs text-slate-500 underline"
                  onClick={() => {
                    window.location.assign("/demo-link/ended");
                  }}
                >
                  End this demo session
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

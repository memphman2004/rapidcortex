"use client";

import { buildProtocolGuidance } from "rapid-cortex-shared";
import type { ProtocolGuidance, TranscriptSegment } from "rapid-cortex-shared";
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock3,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  Shield,
  User,
  Wifi,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { SiteLogoLink } from "@/components/brand/site-logo-link";
import { SITE_NAME } from "@/lib/site";
import {
  type ScenarioKey,
  SHOWCASE_SCENARIOS,
  STARTER_INCIDENTS,
  type StarterIncident,
} from "./showcase-data";

type TranscriptRow = {
  id: string;
  speaker: string;
  text: string;
  time: string;
};

function badgeClasses(type: string | undefined) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border";
  switch (type?.toLowerCase()) {
    case "critical":
      return `${base} border-red-500/30 bg-red-500/15 text-red-200`;
    case "high":
      return `${base} border-amber-500/30 bg-amber-500/15 text-amber-200`;
    case "moderate":
      return `${base} border-blue-500/30 bg-blue-500/15 text-blue-200`;
    case "medical":
      return `${base} border-cyan-500/30 bg-cyan-500/15 text-cyan-200`;
    case "fire":
      return `${base} border-orange-500/30 bg-orange-500/15 text-orange-200`;
    case "police":
      return `${base} border-violet-500/30 bg-violet-500/15 text-violet-200`;
    case "active":
      return `${base} border-emerald-500/30 bg-emerald-500/15 text-emerald-200`;
    case "queued":
      return `${base} border-slate-500/30 bg-slate-500/15 text-slate-200`;
    default:
      return `${base} border-slate-500/30 bg-slate-500/15 text-slate-200`;
  }
}

function ProtocolCoachStrip({ guidance }: { guidance: ProtocolGuidance }) {
  return (
    <div className="rounded-2xl border border-teal-900/50 bg-teal-950/25 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-300/90">
        Protocol coach (approved pack)
      </div>
      <h3 className="mt-1 text-sm font-semibold text-teal-50">{guidance.protocolName}</h3>
      <p className="mt-2 text-xs text-slate-400">
        <span className="font-medium text-slate-300">Step:</span> {guidance.currentStepTitle}
      </p>
      <p className="mt-2 text-sm font-medium leading-relaxed text-teal-100">
        “{guidance.recommendedPhrase}”
      </p>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">{guidance.coachDisclaimer}</p>
    </div>
  );
}

export function RapidCortexShowcaseDashboard() {
  const [incidents] = useState<StarterIncident[]>(STARTER_INCIDENTS);
  const [selectedIncidentId, setSelectedIncidentId] = useState(STARTER_INCIDENTS[0]!.id);
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<ScenarioKey>("cardiac");
  const [isRunning, setIsRunning] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptRow[]>([]);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [connectionState] = useState("Connected");

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) ?? incidents[0]!,
    [incidents, selectedIncidentId],
  );

  const selectedScenario = SHOWCASE_SCENARIOS[selectedScenarioKey];

  const protocolGuidance = useMemo(() => {
    if (!analysisVisible || transcript.length === 0) return null;
    const segments: TranscriptSegment[] = transcript.map((line) => ({
      segmentId: line.id,
      incidentId: selectedIncident.id,
      agencyId: "demo-agency",
      speaker: line.speaker === "dispatcher" ? "dispatcher" : "caller",
      text: line.text,
      timestamp: new Date().toISOString(),
    }));
    return buildProtocolGuidance(segments, "demo-agency", "en");
  }, [analysisVisible, transcript, selectedIncident.id]);

  useEffect(() => {
    const scenario = SHOWCASE_SCENARIOS[selectedScenarioKey];
    if (!isRunning || !scenario) return;

    let cancelled = false;
    const items = scenario.transcript;
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    setTranscript([]);
    setAnalysisVisible(false);

    let cumulative = 0;
    items.forEach((item, index) => {
      cumulative += item.delay;
      const timeoutId = setTimeout(() => {
        if (cancelled) return;
        setTranscript((prev) => [
          ...prev,
          {
            id: `${selectedScenarioKey}-${index}`,
            speaker: item.speaker,
            text: item.text,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        ]);
        if (index === items.length - 1) {
          const t2 = setTimeout(() => {
            if (!cancelled) setAnalysisVisible(true);
          }, 600);
          timeoutIds.push(t2);
        }
      }, cumulative);
      timeoutIds.push(timeoutId);
    });

    return () => {
      cancelled = true;
      timeoutIds.forEach(clearTimeout);
    };
  }, [isRunning, selectedScenarioKey]);

  const startScenario = () => {
    const map: Record<ScenarioKey, string> = {
      cardiac: STARTER_INCIDENTS[0]!.id,
      fire: STARTER_INCIDENTS[1]!.id,
      domestic: STARTER_INCIDENTS[2]!.id,
    };
    setSelectedIncidentId(map[selectedScenarioKey]);
    setIsRunning(true);
  };

  const resetScenario = () => {
    setIsRunning(false);
    setTranscript([]);
    setAnalysisVisible(false);
  };

  const navItems = [
    "Dashboard",
    "Active Incidents",
    "History",
    "Demo Mode",
    "Supervisor",
    "Admin",
  ];

  return (
    <div className="min-h-screen min-h-dvh bg-slate-950/82 text-slate-100 backdrop-blur-md">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950/90 p-5">
          <div className="mb-8 flex items-center gap-3">
            <SiteLogoLink
              href="/"
              heightClass="h-11"
              linkClassName="shrink-0 overflow-hidden rounded-2xl ring-1 ring-cyan-500/20"
            />
            <div>
              <div className="text-lg font-semibold tracking-wide">{SITE_NAME}</div>
              <div className="text-xs text-slate-400">Emergency Response AI</div>
            </div>
          </div>

          <nav className="space-y-2 text-sm">
            {navItems.map((item, idx) => (
              <button
                key={item}
                type="button"
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  idx === 0
                    ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-500/30"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                <span>{item}</span>
                <ChevronRight className="h-4 w-4 opacity-60" />
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">
              System Status
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <Wifi className="h-4 w-4" /> {connectionState}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              AWS Demo Environment · UI Validation Build
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
            <div className="flex min-w-0 items-start gap-4">
              <SiteLogoLink
                href="/"
                heightClass="h-10"
                linkClassName="hidden shrink-0 pt-0.5 sm:inline-flex"
              />
              <div className="min-w-0">
                <h1 className="text-xl font-semibold">Dispatcher Dashboard</h1>
                <p className="text-sm text-slate-400">
                  Product proof, sales demo, UX validation, and integration target
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-300"
              >
                <Bell className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2">
                <Shield className="h-4 w-4 text-cyan-300" />
                <div className="text-sm">
                  <div className="font-medium">Dispatcher Demo</div>
                  <div className="text-xs text-slate-400">Agency: Columbus Pilot</div>
                </div>
                <User className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </header>

          <div className="grid flex-1 grid-cols-[320px_1fr_360px] gap-0">
            <section className="border-r border-slate-800 bg-slate-950/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Active Incidents
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">Live queue and demo sessions</p>
                </div>
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
                  {incidents.length}
                </span>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  placeholder="Search incidents"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-3">
                {incidents.map((incident) => (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => setSelectedIncidentId(incident.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      incident.id === selectedIncidentId
                        ? "border-cyan-500/30 bg-cyan-500/10"
                        : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{incident.title}</div>
                        <div className="text-xs text-slate-400">{incident.id}</div>
                      </div>
                      <span className={badgeClasses(incident.urgency)}>{incident.urgency}</span>
                    </div>
                    <div className="mb-3 text-xs text-slate-400">{incident.preview}</div>
                    <div className="flex flex-wrap gap-2">
                      <span className={badgeClasses(incident.category)}>{incident.category}</span>
                      <span className={badgeClasses(incident.status)}>{incident.status}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{incident.source}</span>
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" /> {incident.opened}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="p-5">
              <div className="mb-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold">{selectedIncident.title}</h2>
                      <span className={badgeClasses(selectedIncident.category)}>
                        {selectedIncident.category}
                      </span>
                      <span className={badgeClasses(selectedIncident.urgency)}>
                        {selectedIncident.urgency}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      Incident ID {selectedIncident.id} · Status {selectedIncident.status}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedScenarioKey}
                      onChange={(e) => setSelectedScenarioKey(e.target.value as ScenarioKey)}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                    >
                      <option value="cardiac">Possible Cardiac Arrest</option>
                      <option value="fire">Structure Fire</option>
                      <option value="domestic">Domestic Disturbance</option>
                    </select>
                    <button
                      type="button"
                      onClick={startScenario}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950"
                    >
                      <Play className="h-4 w-4" /> Start
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRunning(false)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm"
                    >
                      <Pause className="h-4 w-4" /> Pause
                    </button>
                    <button
                      type="button"
                      onClick={resetScenario}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm"
                    >
                      <RotateCcw className="h-4 w-4" /> Reset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {(
                    [
                      { label: "Connection", value: "Live Demo", Icon: Radio },
                      { label: "Transcript Segments", value: String(transcript.length), Icon: Activity },
                      {
                        label: "Escalation",
                        value:
                          analysisVisible && selectedScenario.analysis.escalation
                            ? "Raised"
                            : "Monitoring",
                        Icon: AlertTriangle,
                      },
                      {
                        label: "Confidence",
                        value: analysisVisible
                          ? `${selectedScenario.analysis.confidence}%`
                          : "Pending",
                        Icon: Shield,
                      },
                    ] as const
                  ).map(({ label, value, Icon }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-slate-400">
                        <Icon className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-[0.15em]">{label}</span>
                      </div>
                      <div className="text-lg font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Live Transcript
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Mock now, streaming-ready for live transcription later
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">Auto-scroll active</span>
                </div>

                <div className="h-[540px] space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  {transcript.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-slate-500">
                      Start a scenario to stream transcript chunks into the dashboard.
                    </div>
                  ) : (
                    transcript.map((line) => (
                      <motion.div
                        key={line.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3"
                      >
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                          <span className="uppercase tracking-[0.15em]">{line.speaker}</span>
                          <span>{line.time}</span>
                        </div>
                        <p className="text-sm leading-6 text-slate-100">{line.text}</p>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="border-l border-slate-800 bg-slate-950/60 p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  AI Recommendation Panel
                </h2>
                <p className="mt-1 text-xs text-slate-500">Human-in-the-loop decision support</p>
              </div>

              <div className="space-y-4">
                {protocolGuidance ? <ProtocolCoachStrip guidance={protocolGuidance} /> : null}

                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">Current Assessment</span>
                    <span
                      className={badgeClasses(
                        analysisVisible ? selectedScenario.analysis.urgency : "moderate",
                      )}
                    >
                      {analysisVisible ? selectedScenario.analysis.urgency : "Pending"}
                    </span>
                  </div>

                  {!analysisVisible ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">
                      AI analysis will populate after enough transcript context is available.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                          Likely Category
                        </div>
                        <div className="text-base font-semibold">
                          {selectedScenario.analysis.category}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                          Confidence
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-cyan-400"
                            style={{
                              width: `${selectedScenario.analysis.confidence}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 text-sm text-slate-300">
                          {selectedScenario.analysis.confidence}% confidence
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                          Next Recommended Question
                        </div>
                        <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm leading-6 text-cyan-50">
                          {selectedScenario.analysis.nextQuestion}
                        </p>
                      </div>
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                          Recommended Action
                        </div>
                        <p className="text-sm leading-6 text-slate-200">
                          {selectedScenario.analysis.recommendedAction}
                        </p>
                      </div>
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                          Incident Summary
                        </div>
                        <p className="text-sm leading-6 text-slate-200">
                          {selectedScenario.analysis.summary}
                        </p>
                      </div>
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                          Rationale
                        </div>
                        <p className="text-sm leading-6 text-slate-400">
                          {selectedScenario.analysis.rationale}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                  <div className="mb-3 text-sm font-semibold">Operator Actions</div>
                  <div className="grid gap-2">
                    {["Mark reviewed", "Escalate to supervisor", "Copy summary", "Archive incident"].map(
                      (action) => (
                        <button
                          key={action}
                          type="button"
                          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-left text-sm text-slate-300 hover:border-slate-600"
                        >
                          {action}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                  <div className="mb-3 text-sm font-semibold">Session Timeline</div>
                  <div className="space-y-3 text-sm text-slate-300">
                    <div className="flex items-start gap-3">
                      <Radio className="mt-0.5 h-4 w-4 text-cyan-300" />
                      <span>Demo scenario selected: {selectedScenario.name}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Activity className="mt-0.5 h-4 w-4 text-cyan-300" />
                      <span>Transcript streaming {isRunning ? "active" : "idle"}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                      <span>
                        Escalation state:{" "}
                        {analysisVisible && selectedScenario.analysis.escalation
                          ? "Raised"
                          : "Monitoring"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

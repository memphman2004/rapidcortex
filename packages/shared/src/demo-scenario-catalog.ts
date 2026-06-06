import type { IncidentCategory } from "./types.js";

/** Single row for `/api/demo/scenarios` and offline demo UI — keep in sync with transcript scripts. */
export type DemoScenarioCatalogRow = {
  id: string;
  name: string;
  category: IncidentCategory;
  /** One-line value story for prospects (UI / sales). */
  valuePitch: string;
};

/**
 * Canonical demo scenario list (Phase 11). Keys must match `DEMO_TRANSCRIPT_CHUNKS` in the web app.
 */
export const DEMO_SCENARIO_CATALOG: readonly DemoScenarioCatalogRow[] = [
  {
    id: "cardiac-arrest",
    name: "Cardiac arrest",
    category: "medical",
    valuePitch: "Shows collapse + abnormal breathing → ALS / CPR pathway.",
  },
  {
    id: "aed-retrieval",
    name: "AED retrieval & use",
    category: "medical",
    valuePitch: "Caller locating AED while CPR continues — equipment + coaching flow.",
  },
  {
    id: "house-fire",
    name: "House fire",
    category: "fire",
    valuePitch: "Smoke, flames, exposures — structure fire triage and accountability language.",
  },
  {
    id: "domestic-disturbance",
    name: "Domestic disturbance",
    category: "police",
    valuePitch: "Neighbor report with weapon cue — de-escalation and officer safety framing.",
  },
  {
    id: "welfare-check",
    name: "Welfare check",
    category: "welfare_check",
    valuePitch: "Elder unreachable + access ambiguity — welfare vs medical escalation.",
  },
  {
    id: "panic-open-line",
    name: "Panic / open line",
    category: "unknown",
    valuePitch: "Fragmented audio and distress — uncertainty handling and keep-alive triage.",
  },
] as const;

export function listDemoScenarioRows(): DemoScenarioCatalogRow[] {
  return [...DEMO_SCENARIO_CATALOG];
}

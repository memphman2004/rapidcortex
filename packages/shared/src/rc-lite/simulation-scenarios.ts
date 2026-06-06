/** Sandbox/demo simulation fixtures — never touch production tenants. */

export type RcLiteSimulationScenarioId =
  | "domestic_disturbance"
  | "vehicle_crash"
  | "medical_emergency"
  | "fire_hazmat"
  | "silent_caller"
  | "missing_child"
  | "non_english_caller"
  | "active_threat";

export type RcLiteSimulationScenario = {
  id: RcLiteSimulationScenarioId;
  label: string;
  summary: string;
  /** Example incident description for docs/tests. */
  sampleNarrative: string;
};

export const RC_LITE_SIMULATION_SCENARIOS: readonly RcLiteSimulationScenario[] = [
  {
    id: "domestic_disturbance",
    label: "Domestic disturbance",
    summary: "Escalating voices, children present, weapons uncertainty.",
    sampleNarrative:
      "Caller reports arguing and screaming in the background, possible weapon mentioned, children may be in the home.",
  },
  {
    id: "vehicle_crash",
    label: "Vehicle crash",
    summary: "Highway MVA with unknown injuries and traffic hazard.",
    sampleNarrative:
      "Two-vehicle collision on the interstate, airbags deployed, unknown injuries, fluid on roadway.",
  },
  {
    id: "medical_emergency",
    label: "Medical emergency",
    summary: "Breathing difficulty and altered mental status.",
    sampleNarrative:
      "Elderly male with trouble breathing, turning blue, history of heart problems, conscious but confused.",
  },
  {
    id: "fire_hazmat",
    label: "Fire / hazmat",
    summary: "Structure fire with chemical odor reported.",
    sampleNarrative:
      "Garage fire with strong chemical smell, neighbors reporting dark smoke, unknown occupants inside.",
  },
  {
    id: "silent_caller",
    label: "Silent caller",
    summary: "Open line with background distress cues.",
    sampleNarrative:
      "911 open line, whispering, sounds of struggle, possibly unable to speak.",
  },
  {
    id: "missing_child",
    label: "Missing child",
    summary: "Caregiver reports child missing from school pick-up zone.",
    sampleNarrative:
      "Parent reports 7-year-old last seen near playground, wearing red jacket, no contact for 20 minutes.",
  },
  {
    id: "non_english_caller",
    label: "Non-English caller",
    summary: "Multilingual caller with limited English.",
    sampleNarrative:
      "Caller speaks Spanish, indicates someone is hurt at home, address partially confirmed.",
  },
  {
    id: "active_threat",
    label: "Active threat",
    summary: "Possible active violence in progress.",
    sampleNarrative:
      "Reports of shots fired inside building, multiple callers, unknown number of suspects.",
  },
];

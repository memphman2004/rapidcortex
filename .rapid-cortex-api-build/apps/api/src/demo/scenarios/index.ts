import type { ScenarioDefinition, ScenarioId } from "rapid-cortex-shared";
import { campusMedicalEmergency } from "./campus-medical.js";
import { campusSuspiciousPerson } from "./campus-suspicious-person.js";
import { multilingualCaller } from "./multilingual-caller.js";
import { venueFightSection } from "./venue-fight.js";
import { finish, runStandardWalkthrough } from "./helpers.js";

function canned(
  meta: Omit<ScenarioDefinition, "execute">,
  walk: Parameters<typeof runStandardWalkthrough>[1],
): ScenarioDefinition {
  return {
    ...meta,
    async execute(_agencyId, runner) {
      const { id, checks } = await runStandardWalkthrough(runner, walk);
      return finish(meta, runner, id, checks, { incidentType: walk.type, priority: walk.priority });
    },
  };
}

const campusActiveThreat: ScenarioDefinition = canned(
  {
    id: "campus-active-threat",
    label: "Campus active threat",
    vertical: "campus",
    description: "Weapon reported outside the library — supervisor escalate, cameras, hold-in-place.",
    estimatedDemoMinutes: 8,
    tags: ["campus", "weapon", "priority-1"],
  },
  {
    type: "LEW-WEAPON",
    priority: 1,
    location: { displayName: "Leyburn Library west lawn" },
    reporterMessage: "Person with a rifle walking toward the library. Students running.",
    reportMethod: "phone",
    aiSummary: "Active threat — armed subject west of Leyburn. Initiate hold-in-place and notify PD.",
    cameraIds: ["cam-shaw-north-lot-1"],
    units: [{ unitId: "PD-1", unitType: "police" }],
    escalateReason: "Active threat — command notification required.",
  },
);

const venueLostChild: ScenarioDefinition = canned(
  {
    id: "venue-lost-child",
    label: "Venue lost child",
    vertical: "venue",
    description: "Missing child at guest services — non-violent, high visibility.",
    estimatedDemoMinutes: 4,
    tags: ["venue", "welfare"],
  },
  {
    type: "WELFARE",
    priority: 3,
    location: { displayName: "Guest Services, Gate C" },
    reporterMessage: "We can't find our 6-year-old. Last seen near the lemonade stand.",
    reportMethod: "qr_scan",
    aiSummary: "Lost child, age 6, Gate C. Broadcast description on venue radios. Hold at guest services.",
    units: [{ unitId: "GUEST-SVC-1", unitType: "guest_services" }],
  },
);

const transitSafetyComplaint: ScenarioDefinition = canned(
  {
    id: "transit-safety-complaint",
    label: "Transit safety complaint",
    vertical: "transit",
    description: "Harassment complaint on a high-ridership route.",
    estimatedDemoMinutes: 4,
    tags: ["transit", "welfare"],
  },
  {
    type: "LEW-SUSP",
    priority: 3,
    location: { displayName: "Route 12, stop 8th & Main" },
    reporterMessage: "Someone on the bus is yelling at riders and blocking the aisle.",
    reportMethod: "sms",
    aiSummary: "Disorderly passenger Route 12. Request transit supervisor and local PD if it escalates.",
    units: [{ unitId: "TRANSIT-SUP-1", unitType: "transit_supervisor" }],
  },
);

const nonEmergency311: ScenarioDefinition = canned(
  {
    id: "non-emergency-311",
    label: "Non-emergency 311",
    vertical: "911",
    description: "Noise complaint diverted from emergency queue.",
    estimatedDemoMinutes: 3,
    tags: ["psap", "triage"],
  },
  {
    type: "NOISE",
    priority: 5,
    location: { displayName: "400 Oak Street" },
    reporterMessage: "Neighbor's party has been loud since 11. Not an emergency.",
    reportMethod: "phone",
    aiSummary: "Non-emergency noise. Eligible for 311 / non-emergency triage — do not dispatch P1 units.",
  },
);

const qrNfcReport: ScenarioDefinition = canned(
  {
    id: "qr-nfc-report",
    label: "QR / NFC report",
    vertical: "campus",
    description: "Anonymous QR scan from a campus emergency kiosk.",
    estimatedDemoMinutes: 4,
    tags: ["campus", "qr"],
  },
  {
    type: "WELFARE",
    priority: 3,
    location: { displayName: "Science Center kiosk QR-104" },
    reporterMessage: "Someone passed out on the stairs. I scanned the wall code.",
    reportMethod: "qr_scan",
    aiSummary: "QR kiosk report — unresponsive person Science Center stairs. Verify cameras and send security.",
    cameraIds: ["cam-arnett-lobby-north"],
    units: [{ unitId: "CAMPUS-SEC-4", unitType: "campus_security" }],
  },
);

const supervisorQaReview: ScenarioDefinition = canned(
  {
    id: "supervisor-qa-review",
    label: "Supervisor QA review",
    vertical: "911",
    description: "Closed incident staged for supervisor QA / coaching review.",
    estimatedDemoMinutes: 4,
    tags: ["psap", "qa"],
  },
  {
    type: "MED-TRAUMA",
    priority: 2,
    location: { displayName: "12th & Walnut" },
    reporterMessage: "Pedestrian vs car. Caller is with the patient.",
    reportMethod: "phone",
    aiSummary: "MVA pedestrian. ALS transported. Seeded for supervisor QA scoring walkthrough.",
    units: [{ unitId: "EMS-3", unitType: "ems" }],
    note: "Ready for QA template scoring.",
  },
);

export const SCENARIOS: ScenarioDefinition[] = [
  campusMedicalEmergency,
  campusSuspiciousPerson,
  campusActiveThreat,
  venueFightSection,
  venueLostChild,
  transitSafetyComplaint,
  nonEmergency311,
  multilingualCaller,
  qrNfcReport,
  supervisorQaReview,
];

export function listScenarioCatalog(): Array<Omit<ScenarioDefinition, "execute">> {
  return SCENARIOS.map(({ execute: _execute, ...row }) => row);
}

export function getScenario(id: ScenarioId): ScenarioDefinition | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

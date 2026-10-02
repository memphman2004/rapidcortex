import type { ScenarioDefinition } from "rapid-cortex-shared";
import { finish, runStandardWalkthrough } from "./helpers.js";

const meta = {
  id: "campus-suspicious-person" as const,
  label: "Campus suspicious person",
  vertical: "campus" as const,
  description: "Suspicious person in Shaw parking lot — cameras, duplicate call, supervisor escalate.",
  estimatedDemoMinutes: 5,
  tags: ["campus", "police", "cameras"],
};

export const campusSuspiciousPerson: ScenarioDefinition = {
  ...meta,
  async execute(_agencyId, runner) {
    const aiSummary =
      "Unknown male circling vehicles in Shaw north lot. Possible attempted auto burglary. No weapon observed.";
    const { id, checks } = await runStandardWalkthrough(runner, {
      type: "LEW-SUSP",
      priority: 2,
      location: { displayName: "Shaw Hall north parking lot", lat: 37.7911, lng: -79.4432 },
      reporterMessage: "There's a guy trying door handles on cars in the Shaw lot.",
      reportMethod: "sms",
      aiSummary,
      cameraIds: ["cam-shaw-north-lot-1"],
      units: [{ unitId: "CAMPUS-SEC-1", unitType: "campus_security" }],
      note: "Subject wearing dark hoodie, last seen near lot exit.",
      duplicateMessage: "Second caller reports the same subject walking toward the library.",
      escalateReason: "Possible serial auto burglary — notify supervisor for extra units.",
      extraChecks: [
        {
          checkId: "escalation-flag",
          description: "Escalation indicator visible to supervisor",
          uiLocation: "Supervisor console → Escalated",
          expectedValue: "escalat",
          checkType: "visible",
          required: true,
        },
      ],
    });
    return finish(meta, runner, id, checks, { incidentType: "LEW-SUSP", priority: 2 });
  },
};

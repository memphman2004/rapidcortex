import type { ScenarioDefinition } from "rapid-cortex-shared";
import { finish, runStandardWalkthrough } from "./helpers.js";

const meta = {
  id: "venue-fight-section" as const,
  label: "Venue fight — section 110",
  vertical: "venue" as const,
  description: "Fight in stadium section 110 with camera association and guest-services handoff.",
  estimatedDemoMinutes: 5,
  tags: ["venue", "assault", "cameras"],
};

export const venueFightSection: ScenarioDefinition = {
  ...meta,
  async execute(_agencyId, runner) {
    const aiSummary =
      "Physical altercation, section 110 row 12. Two involved, crowd forming. Request security and medical standby.";
    const { id, checks } = await runStandardWalkthrough(runner, {
      type: "LEW-ASSAULT",
      priority: 2,
      location: { displayName: "Stadium Section 110, Row 12", lat: 39.0489, lng: -94.4839 },
      reporterMessage: "Two guys fighting in 110. People are standing on seats.",
      reportMethod: "phone",
      aiSummary,
      cameraIds: ["cam-sec110-north"],
      units: [
        { unitId: "VENUE-SEC-A", unitType: "venue_security" },
        { unitId: "EMS-STANDBY", unitType: "ems" },
      ],
      note: "Guest services holding adjacent rows. Eject both parties after medical clear.",
      escalateReason: "Crowd surge risk — supervisor awareness.",
      extraChecks: [
        {
          checkId: "camera-bound",
          description: "Section camera associated on the incident",
          uiLocation: "Incident detail → Cameras",
          expectedValue: "cam-sec110-north",
          checkType: "exists",
          required: false,
        },
      ],
    });
    return finish(meta, runner, id, checks, { incidentType: "LEW-ASSAULT", priority: 2 });
  },
};

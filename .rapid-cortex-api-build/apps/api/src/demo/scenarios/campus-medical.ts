import type { ScenarioDefinition } from "rapid-cortex-shared";
import { finish, runStandardWalkthrough } from "./helpers.js";

const meta = {
  id: "campus-medical-emergency" as const,
  label: "Campus medical emergency",
  vertical: "campus" as const,
  description: "Cardiac emergency at Arnett Hall lobby — EMS + campus security walkthrough.",
  estimatedDemoMinutes: 6,
  tags: ["campus", "medical", "priority-1"],
};

export const campusMedicalEmergency: ScenarioDefinition = {
  ...meta,
  async execute(_agencyId, runner) {
    const aiSummary =
      "Unresponsive adult in Arnett Hall north lobby. Bystander CPR in progress. Request ALS and AED.";
    const { id, checks } = await runStandardWalkthrough(runner, {
      type: "MED-CARDIAC",
      priority: 1,
      location: { displayName: "Arnett Hall north lobby, Washington and Lee University", lat: 37.7903, lng: -79.4425 },
      reporterMessage: "My professor collapsed. He's not breathing. We're in the Arnett lobby.",
      reportMethod: "phone",
      aiSummary,
      cameraIds: ["cam-arnett-lobby-north", "cam-arnett-lobby-south"],
      units: [
        { unitId: "EMS-1", unitType: "ems" },
        { unitId: "CAMPUS-SEC-2", unitType: "campus_security" },
      ],
      note: "AED retrieved from lobby cabinet. CPR ongoing.",
      fieldUpdate: "ALS on scene. Patient being packaged for transport.",
      extraChecks: [
        {
          checkId: "priority-critical",
          description: "Incident shows critical / P1 urgency",
          uiLocation: "Incident header",
          expectedValue: "critical",
          checkType: "text_match",
          required: true,
        },
      ],
    });
    return finish(meta, runner, id, checks, { incidentType: "MED-CARDIAC", priority: 1 });
  },
};

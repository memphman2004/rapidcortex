import type { ScenarioDefinition } from "rapid-cortex-shared";
import { finish, runStandardWalkthrough } from "./helpers.js";

const meta = {
  id: "multilingual-caller" as const,
  label: "Multilingual caller",
  vertical: "campus" as const,
  description: "Spanish-language medical caller — translation + RC Translate surfaces.",
  estimatedDemoMinutes: 6,
  tags: ["campus", "translate", "medical"],
};

export const multilingualCaller: ScenarioDefinition = {
  ...meta,
  async execute(_agencyId, runner) {
    const aiSummary =
      "Spanish-speaking caller reports chest pain at Leyburn Library. Language session should show es / interpreter needed.";
    const { id, checks } = await runStandardWalkthrough(runner, {
      type: "MED-CARDIAC",
      priority: 1,
      location: { displayName: "Leyburn Library entrance", lat: 37.7908, lng: -79.4418 },
      reporterMessage: "Me duele el pecho. No hablo inglés. Estoy en la biblioteca.",
      reportMethod: "phone",
      callerLanguage: "es",
      aiSummary,
      units: [
        { unitId: "EMS-2", unitType: "ems" },
        { unitId: "CAMPUS-SEC-3", unitType: "campus_security" },
      ],
      note: "RC Translate active. Do not rely on bystander English.",
      extraChecks: [
        {
          checkId: "caller-language",
          description: "Caller language shows Spanish",
          uiLocation: "Incident header / language chip",
          expectedValue: "es",
          checkType: "text_match",
          required: true,
        },
      ],
    });
    return finish(meta, runner, id, checks, { incidentType: "MED-CARDIAC", priority: 1 });
  },
};

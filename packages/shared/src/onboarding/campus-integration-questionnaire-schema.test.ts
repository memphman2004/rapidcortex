import { describe, expect, it } from "vitest";
import {
  blankCampusIntegrationQuestionnaire,
  campusIntegrationQuestionnaireSchema,
} from "./campus-integration-questionnaire-schema.js";

function validQuestionnaire() {
  const blank = blankCampusIntegrationQuestionnaire("IU");
  return {
    ...blank,
    campuses: [{ code: "BLOOMINGTON", name: "IU Bloomington", city: "Bloomington", state: "IN", kind: "main" as const, active: true }],
    lockdownOperatorConfirmUnderstood: true,
    clerySuggestionOnlyAcknowledged: true,
    implementationLeadName: "Alex Rivera",
    implementationLeadEmail: "alex.rivera@iu.edu",
  };
}

describe("campusIntegrationQuestionnaireSchema", () => {
  it("accepts a complete discovery payload and keeps CAD write-back as planning-only", () => {
    const parsed = campusIntegrationQuestionnaireSchema.parse({
      ...validQuestionnaire(),
      cadWritebackDesired: true,
      cadWritebackAddendumAcknowledged: true,
    });
    expect(parsed.campuses[0]?.code).toBe("BLOOMINGTON");
    expect(parsed.cadWritebackDesired).toBe(true);
    expect(parsed.cadWritebackAddendumAcknowledged).toBe(true);
  });

  it("rejects CAD write-back desired without the fail-closed addendum acknowledgement", () => {
    const parsed = campusIntegrationQuestionnaireSchema.safeParse({
      ...validQuestionnaire(),
      cadWritebackDesired: true,
      cadWritebackAddendumAcknowledged: false,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects submit before lockdown and Clery acknowledgements", () => {
    const parsed = campusIntegrationQuestionnaireSchema.safeParse(blankCampusIntegrationQuestionnaire("IU"));
    expect(parsed.success).toBe(false);
  });
});

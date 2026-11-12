import { describe, expect, it } from "vitest";
import { leadStageForProspectOutreach } from "./leads-crm.js";

describe("leadStageForProspectOutreach", () => {
  it("maps uncontacted prospects to New Lead", () => {
    expect(leadStageForProspectOutreach("UNCONTACTED")).toBe("NEW");
  });

  it("maps early outreach to Contacted", () => {
    expect(leadStageForProspectOutreach("MAILED")).toBe("CONTACTED");
    expect(leadStageForProspectOutreach("CALLED")).toBe("CONTACTED");
    expect(leadStageForProspectOutreach("EMAILED")).toBe("CONTACTED");
  });

  it("maps later outreach onto playbook stages", () => {
    expect(leadStageForProspectOutreach("ENGAGED")).toBe("ENGAGED");
    expect(leadStageForProspectOutreach("DEMO_SCHEDULED")).toBe("DEMO_SCHEDULED");
    expect(leadStageForProspectOutreach("PILOT")).toBe("DEMO_COMPLETED");
    expect(leadStageForProspectOutreach("CUSTOMER")).toBe("WON");
    expect(leadStageForProspectOutreach("NOT_INTERESTED")).toBe("LOST");
  });
});

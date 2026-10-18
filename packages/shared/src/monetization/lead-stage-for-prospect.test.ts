import { describe, expect, it } from "vitest";
import { leadStageForProspectOutreach } from "./leads-crm.js";

describe("leadStageForProspectOutreach", () => {
  it("starts early outreach as Contacted", () => {
    expect(leadStageForProspectOutreach("UNCONTACTED")).toBe("CONTACTED");
    expect(leadStageForProspectOutreach("CALLED")).toBe("CONTACTED");
    expect(leadStageForProspectOutreach("EMAILED")).toBe("CONTACTED");
  });

  it("starts engaged or later as Qualified", () => {
    expect(leadStageForProspectOutreach("ENGAGED")).toBe("QUALIFIED");
    expect(leadStageForProspectOutreach("DEMO_SCHEDULED")).toBe("QUALIFIED");
    expect(leadStageForProspectOutreach("PILOT")).toBe("QUALIFIED");
  });
});

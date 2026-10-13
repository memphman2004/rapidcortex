import { describe, expect, it } from "vitest";
import {
  computeOutreachStats,
  listOutreachAsPsapProspects,
  OUTREACH_PROSPECT_COUNTS,
  verticalFilterLabel,
} from "./outreach-prospects";

describe("outreach prospects catalog", () => {
  it("loads filled sheet totals by vertical", () => {
    expect(OUTREACH_PROSPECT_COUNTS.total).toBe(1033);
    expect(OUTREACH_PROSPECT_COUNTS.byVertical.campus).toBe(447);
    expect(OUTREACH_PROSPECT_COUNTS.byVertical.venue).toBe(469);
    expect(OUTREACH_PROSPECT_COUNTS.byVertical.transit).toBe(117);
  });

  it("maps sheet rows into PSAP-shaped prospects with student counts", () => {
    const campus = listOutreachAsPsapProspects({ vertical: "campus", pageSize: 10 });
    expect(campus.total).toBe(447);
    expect(campus.items[0]?.psapName).toBeTruthy();
    expect(campus.items[0]?.outreachStatus).toBe("UNCONTACTED");
    expect(campus.items[0]?.county).toBeTruthy();
    const withStudents = campus.items.filter((p) => p.studentCount != null);
    expect(withStudents.length).toBeGreaterThan(0);
    expect(withStudents[0]!.studentCount!).toBeGreaterThan(0);
  });

  it("filters by status and list like the PSAP registry", () => {
    const hbcu = listOutreachAsPsapProspects({
      vertical: "campus",
      listKey: "campus-hbcu",
      pageSize: 200,
    });
    expect(hbcu.total).toBe(97);

    const uncontacted = listOutreachAsPsapProspects({
      vertical: "transit",
      outreachStatus: "UNCONTACTED",
      pageSize: 200,
    });
    expect(uncontacted.total).toBe(117);
  });

  it("computes stats strip totals", () => {
    const stats = computeOutreachStats({ vertical: "venue" });
    expect(stats.total).toBe(469);
    expect(stats.byStatus.UNCONTACTED).toBe(469);
  });

  it("labels vertical chips", () => {
    expect(verticalFilterLabel("all")).toBe("All Verticals");
    expect(verticalFilterLabel("psap")).toBe("PSAP / 911");
    expect(verticalFilterLabel("campus")).toBe("Campus");
  });
});

import { describe, expect, it } from "vitest";
import { buildReportIcs, buildReportPdf, reportLines, type IQReportSnapshot } from "./iq-report-export";

const snapshot: IQReportSnapshot = {
  title: "PSAP iQ reporting",
  rangeLabel: "Month",
  generatedAt: "2026-10-29T22:00:00.000Z",
  publicSafe: true,
  kpis: [{ label: "9-1-1 calls", value: "0", trend: "+0" }],
  lineChartLabel: "Avg hourly 9-1-1 call volume",
  hourly: [{ hour: 6, value: 1.5 }],
  breakdownTitle: "Top breakdown (lang_*)",
  breakdown: [],
};

describe("iq report export", () => {
  it("includes the visible metrics in the report text", () => {
    const lines = reportLines(snapshot);
    expect(lines.join("\n")).toContain("9-1-1 calls: 0");
    expect(lines.join("\n")).toContain("Public-safe");
    expect(lines.join("\n")).toContain("06:00  1.5");
  });

  it("builds a PDF the browser can download", async () => {
    const pdf = buildReportPdf(snapshot);
    expect(pdf.type).toBe("application/pdf");
    const text = await pdf.text();
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("9-1-1 calls: 0");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("builds a weekly calendar file for the recipient", () => {
    const ics = buildReportIcs(snapshot, "ops@example.com");
    expect(ics).toContain("RRULE:FREQ=WEEKLY");
    expect(ics).toContain("ATTENDEE:mailto:ops@example.com");
    expect(ics).toContain("PSAP iQ reporting");
  });
});
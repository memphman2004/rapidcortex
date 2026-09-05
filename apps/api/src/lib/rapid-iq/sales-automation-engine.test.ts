import { describe, expect, it } from "vitest";
import { heuristicThreeTouch, listCampaignCards } from "./sales-automation-engine.js";

describe("sales automation engine", () => {
  it("builds a 3-touch heuristic sequence with delay days 0/5/12", () => {
    const steps = heuristicThreeTouch({
      agencyName: "Harris County 911",
      vertical: "PSAP",
      firstName: "Maria",
      signalTitle: "NG911 RFP",
    });
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.label)).toEqual(["initial", "followup_1", "followup_2"]);
    expect(steps.map((s) => s.delayDays)).toEqual([0, 5, 12]);
    expect(steps.every((s) => s.status === "pending")).toBe(true);
    expect(steps[0]?.email.bodyText).toContain("Hi Maria");
    expect(steps[0]?.email.bodyText).toContain("The Rapid Cortex team");
    expect(steps[0]?.email.bodyText).not.toMatch(/Jeff Coleman/i);
  });

  it("marks conference cards active only in the 28–33 day window", () => {
    const now = Date.now();
    const iso = (days: number) => new Date(now + days * 86_400_000).toISOString().slice(0, 10);
    const cards = listCampaignCards([
      {
        conferenceId: "in-window",
        name: "Window Conf",
        startDate: iso(30),
        location: "Austin, TX",
        vertical: "911",
      },
      {
        conferenceId: "too-soon",
        name: "Soon Conf",
        startDate: iso(10),
        location: "Dallas, TX",
        vertical: "911",
      },
      {
        conferenceId: "too-far",
        name: "Far Conf",
        startDate: iso(90),
        location: "Denver, CO",
        vertical: "campus",
      },
      {
        conferenceId: "past",
        name: "Past Conf",
        startDate: iso(-5),
        location: "Miami, FL",
      },
    ]);
    const conf = cards.filter((c) => c.id.startsWith("conf-"));
    expect(conf.map((c) => c.id)).toEqual(["conf-in-window", "conf-too-soon", "conf-too-far"]);
    expect(conf.find((c) => c.id === "conf-in-window")?.status).toBe("active");
    expect(conf.find((c) => c.id === "conf-too-soon")?.status).toBe("scheduled");
    expect(conf.find((c) => c.id === "conf-too-far")?.status).toBe("scheduled");
  });
});

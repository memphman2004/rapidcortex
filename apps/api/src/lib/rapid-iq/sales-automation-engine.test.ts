import { describe, expect, it } from "vitest";
import {
  applyDraftEmailPatch,
  applySequenceEmailPatch,
  heuristicThreeTouch,
  listCampaignCards,
  summarizeBulkBatches,
} from "./sales-automation-engine.js";

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
    expect(steps[0]?.email.bodyText).toContain("The NexCort iQ team");
    expect(steps[0]?.email.bodyText).not.toMatch(/Jeff Coleman/i);
    expect(steps[0]?.email.subject).toMatch(/less typing while the call is still live/i);
    expect(steps[0]?.email.bodyText).toMatch(/does not replace CAD/i);
    expect(steps[1]?.email.bodyText).toMatch(/system of record/i);
  });

  it("uses campus QR copy and venue guest-report copy", () => {
    const campus = heuristicThreeTouch({
      agencyName: "State University",
      vertical: "CAMPUS",
      firstName: "Alex",
    });
    expect(campus[0]?.email.subject).toMatch(/will not call 911/i);
    expect(campus[0]?.email.bodyText).toMatch(/not a 911 emergency dispatch system/i);
    expect(campus[0]?.email.bodyText).toMatch(/QR/i);

    const venue = heuristicThreeTouch({
      agencyName: "Metro Stadium",
      vertical: "VENUE",
    });
    expect(venue[0]?.email.subject).toMatch(/radio/i);
    expect(venue[0]?.email.bodyText).toMatch(/not a 911 dispatch system/i);
    expect(venue[1]?.email.bodyText).toMatch(/RTSP/i);
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
    expect(cards.map((c) => c.id)).toEqual(
      expect.arrayContaining(["psap-core-2026", "campus-safety-2026", "venue-ops-2026"]),
    );
    expect(conf.map((c) => c.id)).toEqual(["conf-in-window", "conf-too-soon", "conf-too-far"]);
    expect(conf.find((c) => c.id === "conf-in-window")?.status).toBe("active");
    expect(conf.find((c) => c.id === "conf-too-soon")?.status).toBe("scheduled");
    expect(conf.find((c) => c.id === "conf-too-far")?.status).toBe("scheduled");
  });

  it("rolls 100+ sequences into one bulk batch for approval", () => {
    const sequences = Array.from({ length: 120 }, (_, i) => ({
      sequenceId: `seq_${i}`,
      triggerId: "bulk_1",
      triggerType: "campaign" as const,
      vertical: "PSAP" as const,
      recipientEmail: `dir${i}@example.gov`,
      agencyName: `Agency ${i}`,
      status: "draft" as const,
      autoApprove: false,
      steps: [],
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
      attribution: { campaignId: "bulk_1", campaignName: "911 Core outbound" },
    }));
    const batches = summarizeBulkBatches(sequences as never);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.draftCount).toBe(120);
    expect(batches[0]?.campaignName).toBe("911 Core outbound");
  });

  it("lets operators rewrite unsent auto-generated emails", () => {
    const seq = {
      sequenceId: "seq_1",
      triggerId: "t1",
      triggerType: "campaign" as const,
      vertical: "PSAP" as const,
      recipientEmail: "chief@example.gov",
      recipientName: "Pat",
      agencyName: "Franklin County",
      status: "draft" as const,
      autoApprove: false,
      steps: heuristicThreeTouch({ agencyName: "Franklin County", vertical: "PSAP", firstName: "Pat" }),
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
      attribution: {},
    };
    const next = applySequenceEmailPatch(seq, {
      steps: [
        {
          stepNumber: 1,
          email: { subject: "Custom subject", bodyText: "Custom body for Franklin." },
          scheduledAt: "2026-09-20T15:00:00.000Z",
        },
      ],
    });
    expect(next.steps[0]?.email.subject).toBe("Custom subject");
    expect(next.steps[0]?.email.bodyText).toBe("Custom body for Franklin.");
    expect(next.steps[0]?.scheduledAt).toBe("2026-09-20T15:00:00.000Z");
    expect(next.steps[1]?.email.subject).toBe(seq.steps[1]?.email.subject);
  });

  it("blocks edits after a step has sent", () => {
    const steps = heuristicThreeTouch({ agencyName: "Franklin County", vertical: "PSAP" });
    steps[0] = { ...steps[0]!, status: "sent", sentAt: "2026-09-16T12:00:00.000Z" };
    const seq = {
      sequenceId: "seq_1",
      triggerId: "t1",
      triggerType: "campaign" as const,
      vertical: "PSAP" as const,
      recipientEmail: "chief@example.gov",
      agencyName: "Franklin County",
      status: "active" as const,
      autoApprove: false,
      steps,
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
      attribution: {},
    };
    expect(() =>
      applySequenceEmailPatch(seq, {
        steps: [{ stepNumber: 1, email: { subject: "Nope", bodyText: "Too late" } }],
      }),
    ).toThrow(/already sent/);
  });

  it("lets operators rewrite a newsletter draft", () => {
    const next = applyDraftEmailPatch(
      {
        draftId: "d1",
        contentType: "newsletter",
        vertical: "ALL",
        bodyText: "Old notes",
        status: "draft",
        createdAt: "2026-09-16T00:00:00.000Z",
        updatedAt: "2026-09-16T00:00:00.000Z",
        generatedBy: "composer",
      },
      { subject: "Inside the Cortex — 2026-09-14", bodyText: "Edited notes" },
    );
    expect(next.subject).toBe("Inside the Cortex — 2026-09-14");
    expect(next.bodyText).toBe("Edited notes");
  });
});

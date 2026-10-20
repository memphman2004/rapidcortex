import { describe, expect, it } from "vitest";
import {
  buildEtaMessage,
  callerGuidancePresentation,
  isPreArrivalReasonMissing,
  createPreArrivalSessionBodySchema,
  blurEstimatedArrivalMinutes,
  classifyPreArrivalSessionMode,
  decideCadAutoOpen,
  toCallerChannelPublicItem,
  isRestrictedNatureCode,
  preArrivalPublicViewSchema,
  resolveResponseIQInstructions,
  shouldSendEtaNotification,
  toPreArrivalPublicView,
  type PreArrivalSession,
} from "./index.js";

describe("resolveResponseIQInstructions hierarchy", () => {
  it("prefers agency SOP over protocol library", () => {
    const out = resolveResponseIQInstructions({
      cadNatureCode: "CARDIAC_ARREST",
      policy: {
        showInstructions: true,
        stayOnLine: true,
        sopSteps: [{ cadNaturePattern: "CARDIAC*", steps: ["Agency step one", "Agency step two"] }],
      },
    });
    expect(out.source).toBe("agency_sop");
    expect(out.instructions.map((i) => i.text)).toEqual(["Agency step one", "Agency step two"]);
  });

  it("uses protocol library when no agency SOP matches", () => {
    const out = resolveResponseIQInstructions({ cadNatureCode: "FIRE_STRUCTURE" });
    expect(out.source).toBe("protocol_library");
    expect(out.protocolId).toBe("FIRE_v1");
    expect(out.instructions.length).toBeGreaterThan(0);
  });

  it("falls back to safety catch-all, not medical advice", () => {
    const out = resolveResponseIQInstructions({ cadNatureCode: "UNKNOWN_WEIRD" });
    expect(out.source).toBe("protocol_library");
    expect(out.protocolId).toBe("GENERIC_SAFETY_v1");
    const text = out.instructions.map((i) => i.text).join(" ");
    expect(text.toLowerCase()).not.toContain("food");
    expect(text.toLowerCase()).not.toContain("unlock");
  });

  it("gives robbery callers safety steps, not medical steps", () => {
    const out = resolveResponseIQInstructions({ cadNatureCode: "Robbery in progress" });
    expect(out.protocolId).toBe("CRIME_IN_PROGRESS_v1");
    const text = out.instructions.map((i) => i.text).join(" ");
    expect(text.toLowerCase()).toContain("out of sight");
    expect(text.toLowerCase()).not.toContain("food");
    expect(text.toLowerCase()).not.toContain("unlock your door");
  });

  it("keeps medical guidance on medical natures", () => {
    const out = resolveResponseIQInstructions({ cadNatureCode: "MEDICAL" });
    expect(out.protocolId).toBe("GENERIC_MEDICAL_v1");
  });

  it.each([
    ["MVC", "VEHICLE_CRASH_v1", "hazard"],
    ["OVERDOSE", "OVERDOSE_v1", "naloxone"],
    ["STROKE", "STROKE_v1", "last seen normal"],
    ["UNCONSCIOUS", "UNCONSCIOUS_v1", "wake them"],
    ["RESPIRATORY", "RESPIRATORY_v1", "sit upright"],
    ["SEIZURE", "SEIZURE_v1", "mouth"],
    ["HAZMAT", "HAZMAT_EVACUATE_v1", "fresh air"],
    ["WELFARE_CHECK", "WELFARE_CHECK_v1", "stay with them"],
    ["MISSING_PERSON", "MISSING_PERSON_v1", "phone"],
  ] as const)("maps %s to %s with caller steps", (nature, protocolId, needle) => {
    const out = resolveResponseIQInstructions({ cadNatureCode: nature });
    expect(out.protocolId).toBe(protocolId);
    expect(out.instructions.map((i) => i.text).join(" ").toLowerCase()).toContain(needle);
  });
});

describe("callerGuidancePresentation", () => {
  it("acknowledges a robbery without medical copy", () => {
    const copy = callerGuidancePresentation("ROBBERY");
    expect(copy.tone).toBe("crime");
    expect(copy.heardLine.toLowerCase()).toContain("robbery");
    expect(copy.headline.toLowerCase()).toContain("hidden");
    expect(copy.footer.toLowerCase()).toContain("do not take photos");
  });

  it("uses crash-specific copy for MVC", () => {
    const copy = callerGuidancePresentation("MVC");
    expect(copy.tone).toBe("crash");
    expect(copy.heardLine.toLowerCase()).toContain("vehicle crash");
    expect(copy.headline.toLowerCase()).toContain("traffic");
  });

  it("treats a blank or unknown nature as no caller reason", () => {
    expect(isPreArrivalReasonMissing("")).toBe(true);
    expect(isPreArrivalReasonMissing("  ")).toBe(true);
    expect(isPreArrivalReasonMissing("UNKNOWN")).toBe(true);
    expect(isPreArrivalReasonMissing("ROBBERY")).toBe(false);
  });
});

describe("ETA helpers", () => {
  it("builds on-scene message without unit IDs", () => {
    const msg = buildEtaMessage("on_scene", null);
    expect(msg.toLowerCase()).toContain("on scene");
    expect(msg).not.toMatch(/UNIT|officer/i);
  });

  it("shouldSendEtaNotification always allows on_scene and first notify", () => {
    expect(
      shouldSendEtaNotification({
        trigger: "on_scene",
        newEtaMinutes: null,
        lastEtaNotifiedAt: new Date().toISOString(),
        lastKnownEtaMinutes: 5,
      }),
    ).toBe(true);
    expect(
      shouldSendEtaNotification({
        trigger: "eta_updated",
        newEtaMinutes: 8,
      }),
    ).toBe(true);
  });

  it("throttles small ETA deltas within 90s", () => {
    expect(
      shouldSendEtaNotification({
        trigger: "eta_updated",
        newEtaMinutes: 5,
        lastKnownEtaMinutes: 5,
        lastEtaNotifiedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });
});

describe("restricted natures + Zod", () => {
  it("terminates restricted nature codes", () => {
    expect(isRestrictedNatureCode("ACTIVE_SHOOTER")).toBe(true);
    expect(isRestrictedNatureCode("chest_pain")).toBe(false);
  });

  it("parses create session body", () => {
    const parsed = createPreArrivalSessionBodySchema.safeParse({
      incidentId: "inc-1",
      callerPhoneE164: "+15551234567",
      modePolicy: { showInstructions: true, stayOnLine: true },
    });
    expect(parsed.success).toBe(true);
  });

  it("toPreArrivalPublicView exposes stayOnLine", () => {
    const session: PreArrivalSession = {
      sessionToken: "tokentoken12",
      agencyId: "agency-1",
      incidentId: "inc-1",
      status: "active",
      cadNatureCode: "CARDIAC_ARREST",
      instructions: [],
      activeSteps: [],
      modePolicy: { showInstructions: true, stayOnLine: true },
      responderStatus: "dispatched",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      etaNotifications: [],
    };
    const view = toPreArrivalPublicView(session);
    expect(view.stayOnLine).toBe(true);
    expect(view.sessionMode).toBe("FULL");
    expect(view).not.toHaveProperty("lastKnownEtaMinutes");
    expect(preArrivalPublicViewSchema.safeParse(view).success).toBe(true);
  });

  it("classifies modes and blurs ETA so the precise minute is not recoverable", () => {
    expect(classifyPreArrivalSessionMode("active shooter")).toBe("RESTRICTED");
    expect(classifyPreArrivalSessionMode("ROBBERY_IN_PROGRESS")).toBe("STATUS_ONLY");
    expect(classifyPreArrivalSessionMode("CHEST_PAIN")).toBe("FULL");
    const range = blurEstimatedArrivalMinutes(7);
    expect(range).not.toBeNull();
    expect(range!.low).toBeLessThanOrEqual(5);
    expect(range!.high).toBeGreaterThanOrEqual(9);
    expect(range!.low).not.toBe(7);
    expect(range!.high).not.toBe(7);
    const message = buildEtaMessage("unit_dispatched", 7);
    expect(message).toContain(`${range!.low} to ${range!.high}`);
    expect(message).not.toMatch(/\b7\b/);
  });

  it("withholds ETA and instructions on a status-only public view", () => {
    const session: PreArrivalSession = {
      sessionToken: "tokentoken12",
      agencyId: "agency-1",
      incidentId: "inc-1",
      status: "active",
      cadNatureCode: "ROBBERY",
      instructions: [
        {
          stepId: "s1",
          order: 1,
          category: "SCENE_SAFETY",
          status: "ACTIVE",
          text: "Hide",
        },
      ],
      activeSteps: [],
      modePolicy: { showInstructions: true, stayOnLine: true },
      responderStatus: "responding",
      lastKnownEtaMinutes: 7,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      etaNotifications: [],
    };
    const view = toPreArrivalPublicView(session);
    expect(view.sessionMode).toBe("STATUS_ONLY");
    expect(view.instructions).toEqual([]);
    expect(view.etaRangeLow).toBeUndefined();
    expect(view.routeProgress).toBeUndefined();
    expect(view.cadNatureCode).toBe("STATUS");
    expect(view.channelOpen).toBe(false);
  });

  it("opens a CAD session only when the nature is allowed and a callback exists", () => {
    expect(
      decideCadAutoOpen({ natureCode: "CHEST_PAIN", callerPhoneE164: "+15551234567", hasOpenSession: false }),
    ).toBe("open");
    expect(
      decideCadAutoOpen({ natureCode: "ACTIVE_SHOOTER", callerPhoneE164: "+15551234567", hasOpenSession: false }),
    ).toBe("restricted");
    expect(
      decideCadAutoOpen({ natureCode: "CHEST_PAIN", callerPhoneE164: null, hasOpenSession: false }),
    ).toBe("missing_phone");
    expect(
      decideCadAutoOpen({ natureCode: "CHEST_PAIN", callerPhoneE164: "+15551234567", hasOpenSession: true }),
    ).toBe("already_open");
  });

  it("hides coordinates and object keys from the caller channel view", () => {
    const item = toCallerChannelPublicItem({
      messageId: "msg_1",
      agencyId: "agency-1",
      incidentId: "inc-1",
      sessionToken: "tokentoken12",
      kind: "location",
      from: "caller",
      latitude: 39.1,
      longitude: -76.6,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(item?.mediaLabel).toBe("Location shared");
    expect(item).not.toHaveProperty("latitude");
    expect(
      toCallerChannelPublicItem({
        messageId: "msg_2",
        agencyId: "agency-1",
        incidentId: "inc-1",
        sessionToken: "tokentoken12",
        kind: "photo",
        from: "caller",
        mediaStatus: "pending",
        s3Key: "pre-arrival/secret",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBeNull();
  });
});

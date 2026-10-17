import { describe, expect, it } from "vitest";
import {
  buildEtaMessage,
  createPreArrivalSessionBodySchema,
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

  it("falls back to generic library catch-all", () => {
    const out = resolveResponseIQInstructions({ cadNatureCode: "UNKNOWN_WEIRD" });
    expect(out.source).toBe("protocol_library");
    expect(out.protocolId).toBe("GENERIC_MEDICAL_v1");
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
    expect(preArrivalPublicViewSchema.safeParse(view).success).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { pushIncidentContext, type GatewayIncidentContext } from "./gateway.js";
import {
  dashboardLayout,
  decideProductAccess,
  getDeploymentConfig,
  hasCAD,
  hasCore,
  hasResponder,
  hasRMS,
  hasUnifiedWorkspace,
  productLicenseChange,
  productNavDecision,
  productsThatContinue,
  readAgencyEntitlements,
  sessionProductEntitlements,
  type AgencyEntitlements,
} from "./products.js";

function entitlements(products: AgencyEntitlements["products"]): AgencyEntitlements {
  return { products };
}

const core = entitlements(["NEXCORT_CORE"]);
const cadRms = entitlements(["NEXCORT_CAD", "NEXCORT_RMS"]);
const unified = entitlements(["NEXCORT_CORE", "NEXCORT_CAD", "NEXCORT_RMS"]);
const none = entitlements([]);

const incident: GatewayIncidentContext = {
  incidentId: "inc-1",
  agencyId: "agency-a",
  nature: "medical",
  address: "1 Main",
  priority: 1,
  units: ["M1"],
  cadTimestamp: "2026-10-24T12:00:00.000Z",
};

describe("product entitlements", () => {
  it("maps Core only", () => {
    expect(getDeploymentConfig(core)).toBe("CORE_ONLY");
    expect(hasCore(core)).toBe(true);
    expect(hasCAD(core)).toBe(false);
    expect(hasUnifiedWorkspace(core)).toBe(false);
  });

  it("maps CAD and RMS without Core", () => {
    expect(getDeploymentConfig(cadRms)).toBe("CAD_ONLY");
    expect(hasCAD(cadRms)).toBe(true);
    expect(hasRMS(cadRms)).toBe(true);
    expect(hasCore(cadRms)).toBe(false);
  });

  it("maps Core plus CAD as unified", () => {
    expect(getDeploymentConfig(unified)).toBe("UNIFIED");
    expect(hasUnifiedWorkspace(unified)).toBe(true);
    expect(hasRMS(unified)).toBe(true);
  });

  it("maps an empty list to none", () => {
    expect(getDeploymentConfig(none)).toBe("NONE");
    expect(hasCore(none)).toBe(false);
    expect(hasCAD(none)).toBe(false);
  });

  it("treats a missing agency attribute as Core", () => {
    expect(readAgencyEntitlements(undefined).products).toEqual(["NEXCORT_CORE"]);
    expect(sessionProductEntitlements(undefined)).toEqual({
      products: ["NEXCORT_CORE"],
      config: "CORE_ONLY",
    });
  });

  it("keeps an explicit empty list as none in the session", () => {
    expect(sessionProductEntitlements(none)).toEqual({ products: [], config: "NONE" });
  });

  it("hides dispatch for Core only", () => {
    expect(productNavDecision("NEXCORT_CAD", core)).toBe("hidden");
    expect(productNavDecision("NEXCORT_RMS", core)).toBe("hidden");
    expect(productNavDecision("NEXCORT_CORE", core)).toBe("shown");
  });

  it("hides intelligence for CAD and RMS only", () => {
    expect(productNavDecision("NEXCORT_CORE", cadRms)).toBe("hidden");
    expect(productNavDecision("NEXCORT_CAD", cadRms)).toBe("shown");
    expect(productNavDecision("NEXCORT_RMS", cadRms)).toBe("shown");
  });

  it("shows every licensed group in unified", () => {
    expect(productNavDecision("NEXCORT_CORE", unified)).toBe("shown");
    expect(productNavDecision("NEXCORT_CAD", unified)).toBe("shown");
    expect(productNavDecision("NEXCORT_RMS", unified)).toBe("shown");
  });

  it("keeps a licensed product visible when that service is down", () => {
    expect(productNavDecision("NEXCORT_CORE", unified, "disconnected")).toBe("degraded");
    expect(productNavDecision("NEXCORT_CAD", unified, "connected")).toBe("shown");
  });

  it("hides responder unless CAD is also licensed", () => {
    const responderOnly = entitlements(["NEXCORT_RESPONDER"]);
    const responderCad = entitlements(["NEXCORT_CAD", "NEXCORT_RESPONDER"]);
    expect(hasResponder(responderOnly)).toBe(true);
    expect(productNavDecision("NEXCORT_RESPONDER", responderOnly)).toBe("hidden");
    expect(productNavDecision("NEXCORT_RESPONDER", responderCad)).toBe("shown");
  });

  it("denies an unlicensed CAD route with PRODUCT_NOT_LICENSED", () => {
    expect(decideProductAccess(core, "NEXCORT_CAD")).toEqual({
      allowed: false,
      denial: {
        error: "Your agency does not have a license for NEXCORT_CAD",
        code: "PRODUCT_NOT_LICENSED",
        product: "NEXCORT_CAD",
      },
    });
  });

  it("denies Core routes for a CAD-only agency", () => {
    const decision = decideProductAccess(cadRms, "NEXCORT_CORE");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("PRODUCT_NOT_LICENSED");
  });

  it("allows a licensed product", () => {
    expect(decideProductAccess(unified, "NEXCORT_RMS")).toEqual({ allowed: true });
  });

  it("records license removal and restoration", () => {
    const removed = productLicenseChange(unified.products, core.products);
    expect(removed.removed).toEqual(["NEXCORT_CAD", "NEXCORT_RMS"]);
    expect(removed.added).toEqual([]);
    const restored = productLicenseChange(core.products, unified.products);
    expect(restored.added).toEqual(["NEXCORT_CAD", "NEXCORT_RMS"]);
    expect(getDeploymentConfig(entitlements(restored.updated))).toBe("UNIFIED");
  });

  it("uses the caller agency, not a second agency list", () => {
    const agencyB = entitlements(["NEXCORT_CAD"]);
    expect(decideProductAccess(core, "NEXCORT_CAD").allowed).toBe(false);
    expect(decideProductAccess(agencyB, "NEXCORT_CAD").allowed).toBe(true);
  });

  it("leaves sibling products running when one service is down", () => {
    expect(productsThatContinue(unified, "cad")).toEqual(["NEXCORT_CORE", "NEXCORT_RMS"]);
    expect(productsThatContinue(unified, "core")).toEqual(["NEXCORT_CAD", "NEXCORT_RMS"]);
  });

  it("lays out Core tiles without a dispatch hero", () => {
    const layout = dashboardLayout(core);
    expect(layout.hero).toBeNull();
    expect(layout.tiles).toEqual(["active-calls", "live-transcripts", "video-feeds"]);
    expect(layout.tiles).not.toContain("open-incidents");
  });

  it("lays out a CAD hero plus records tiles", () => {
    const layout = dashboardLayout(cadRms);
    expect(layout.config).toBe("CAD_ONLY");
    expect(layout.hero).toBe("dispatch-workspace");
    expect(layout.tiles).toEqual(["open-incidents", "units-active", "pending-reports"]);
  });

  it("lays out unified dispatch plus intelligence tiles", () => {
    const layout = dashboardLayout(unified);
    expect(layout.hero).toBe("dispatch-workspace");
    expect(layout.columns).toBe(3);
    expect(layout.tiles[0]).toBe("active-calls");
    expect(layout.tiles).toContain("pending-reports");
  });

  it("renders no product tiles when nothing is licensed", () => {
    expect(dashboardLayout(none)).toEqual({
      config: "NONE",
      columns: 3,
      hero: null,
      tiles: [],
    });
  });

  it("does not send gateway context when the workspace is not unified", async () => {
    const send = vi.fn();
    const warn = vi.fn();
    await pushIncidentContext(core, "agency-a", incident, send, warn);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not send another agency's incident", async () => {
    const send = vi.fn();
    const warn = vi.fn();
    await pushIncidentContext(unified, "agency-a", { ...incident, agencyId: "agency-b" }, send, warn);
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("gateway_agency_mismatch", expect.objectContaining({ agencyId: "agency-a" }));
  });

  it("warns and continues when the gateway send fails", async () => {
    const warn = vi.fn();
    await expect(
      pushIncidentContext(
        unified,
        "agency-a",
        incident,
        async () => {
          throw new Error("bus unavailable");
        },
        warn,
      ),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "gateway_push_failed",
      expect.objectContaining({ incidentId: "inc-1", error: "bus unavailable" }),
    );
  });

  it("sends context for the same agency in a unified workspace", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const warn = vi.fn();
    await pushIncidentContext(unified, "agency-a", incident, send, warn);
    expect(send).toHaveBeenCalledWith(incident);
    expect(warn).not.toHaveBeenCalled();
  });
});

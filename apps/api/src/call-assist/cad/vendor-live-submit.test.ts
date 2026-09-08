import { describe, expect, it } from "vitest";
import { CALL_ASSIST_CAD_CREATE_PATH, cadVendorBody } from "./vendor-live-submit.js";

describe("Call Assist CAD vendor live submit", () => {
  it("uses the same create paths as the integrations CAD adapters", () => {
    expect(CALL_ASSIST_CAD_CREATE_PATH["motorola-premierone"]).toBe("/api/v1/incidents");
    expect(CALL_ASSIST_CAD_CREATE_PATH["tyler-new-world"]).toBe("/api/cad/incidents");
    expect(CALL_ASSIST_CAD_CREATE_PATH["hexagon-intergraph"]).toBe("/icad/api/calls");
    expect(CALL_ASSIST_CAD_CREATE_PATH.centralsquare).toBe("/api/calls");
    expect(CALL_ASSIST_CAD_CREATE_PATH.zetron).toBe("/incidents");
  });

  it("emits vendor-shaped create bodies", () => {
    const payload = {
      agencyId: "a1",
      classification: "NOISE_COMPLAINT",
      intake: { locationText: "4200 Main", callerName: "Pat" },
      location: { text: "4200 Main" },
    };
    expect(cadVendorBody(payload, "centralsquare").call_type).toBe("NOISE_COMPLAINT");
    expect(cadVendorBody(payload, "tyler-new-world").call_type_cd).toBe("NOISE_COMPLAINT");
    expect(cadVendorBody(payload, "hexagon-intergraph").CallCode).toBe("NOISE_COMPLAINT");
    expect(cadVendorBody(payload, "motorola-premierone").CallType).toBe("NOISE_COMPLAINT");
    expect(cadVendorBody(payload, "zetron").type).toBe("NOISE_COMPLAINT");
  });
});

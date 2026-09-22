import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPsapPopupHTML, clearPsapOverlayCache, loadPsapOverlay } from "./psap-overlay";

afterEach(() => {
  clearPsapOverlayCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buildPsapPopupHTML", () => {
  it("renders name, place, and county for hover", () => {
    const html = buildPsapPopupHTML({
      name: "Muscogee County 911",
      city: "Columbus",
      state: "GA",
      county: "Muscogee",
      cadVendor: "Motorola",
    });
    expect(html).toContain("Muscogee County 911");
    expect(html).toContain("Columbus, GA");
    expect(html).toContain("County: Muscogee");
    expect(html).toContain("CAD: Motorola");
    expect(html).toContain("PSAP");
  });

  it("escapes HTML in PSAP names", () => {
    const html = buildPsapPopupHTML({ name: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("loadPsapOverlay", () => {
  it("loads the operational directory and does not fall back to RC Admin CRM pins", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/map/psaps")) {
        return {
          ok: true,
          json: async () => ({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [-84.65, 33.35] },
                properties: {
                  id: "psap-1",
                  name: "Coweta 911",
                  city: "Newnan",
                  state: "GA",
                  county: "Coweta",
                  phone: "",
                  cadVendor: "",
                  psapType: "",
                },
              },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await loadPsapOverlay();
    expect(data.features).toHaveLength(1);
    expect(data.features[0]?.properties.name).toBe("Coweta 911");
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual(["/api/map/psaps"]);
  });

  it("returns empty GeoJSON when the directory is forbidden", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })));
    const data = await loadPsapOverlay();
    expect(data).toEqual({ type: "FeatureCollection", features: [] });
  });
});

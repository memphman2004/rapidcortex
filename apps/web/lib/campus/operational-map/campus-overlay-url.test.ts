import { describe, expect, it } from "vitest";
import { campusOverlayFetchUrl, isHttpsOverlayUrl } from "./campus-overlay-url";

describe("campus overlay URL", () => {
  it("rewrites an ArcGIS FeatureServer to a GeoJSON query", () => {
    expect(
      campusOverlayFetchUrl("https://gis.iu.edu/arcgis/rest/services/campus/FeatureServer/0"),
    ).toContain("f=geojson");
  });

  it("rejects non-https", () => {
    expect(isHttpsOverlayUrl("http://evil.example/x.json")).toBe(false);
    expect(isHttpsOverlayUrl("https://gis.iu.edu/overlay.json")).toBe(true);
  });
});

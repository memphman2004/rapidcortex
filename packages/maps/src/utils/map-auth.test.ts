import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alsV2ResourceTypeForSigning } from "./map-auth";

describe("map auth ready gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("starts not-ready until markMapAuthReady (even with no identity pool env)", async () => {
    vi.stubEnv("NEXT_PUBLIC_ALS_IDENTITY_POOL_ID", "");
    const auth = await import("./map-auth");
    expect(auth.isMapAuthReady()).toBe(false);
    auth.setMapTransformRequest(((url: string) => ({ url })) as never);
    auth.markMapAuthReady();
    expect(auth.isMapAuthReady()).toBe(true);
  });
});

describe("alsV2ResourceTypeForSigning", () => {
  it("leaves non-ALS URLs unchanged", () => {
    expect(alsV2ResourceTypeForSigning("https://example.com/tiles/0/0/0", "Source")).toBe("Source");
  });

  it("does not force signing on V2 style descriptors", () => {
    expect(
      alsV2ResourceTypeForSigning(
        "https://maps.geo.us-east-1.amazonaws.com/v2/styles/Standard/descriptor?color-scheme=Dark",
        "Style",
      ),
    ).toBe("Style");
  });

  it("forces Tile so the AWS helper signs V2 tiles when MapLibre omits resourceType", () => {
    expect(
      alsV2ResourceTypeForSigning(
        "https://maps.geo.us-east-1.amazonaws.com/v2/tiles/vector.basemap/12/1174/1565",
      ),
    ).toBe("Tile");
  });

  it("forces Tile for V2 glyphs and sprites", () => {
    expect(
      alsV2ResourceTypeForSigning(
        "https://maps.geo.us-east-1.amazonaws.com/v2/glyphs/Amazon Ember/0-255.pbf",
        "Glyphs",
      ),
    ).toBe("Tile");
    expect(
      alsV2ResourceTypeForSigning(
        "https://maps.geo.us-east-1.amazonaws.com/v2/styles/4_1_0-beta_1/Standard/Dark/Default/sprites/sprites.json",
        "SpriteJSON",
      ),
    ).toBe("Tile");
  });
});

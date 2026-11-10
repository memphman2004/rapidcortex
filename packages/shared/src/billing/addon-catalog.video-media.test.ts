import { describe, expect, it } from "vitest";
import { ADDON_CATALOG, getAddonByKey } from "./addon-catalog.js";
import { ADDON_KEYS } from "./addon-types.js";
import { PRICING_DEFAULTS } from "./pricing-defaults.js";

const STANDALONE_VIDEO_KEYS = [
  "caller_media.video_assist",
  "caller_media.live_video_kvs",
  "vision.iq_vision",
  "connect.nest",
  "connect.wyze",
  "rc_video.wall",
  "rc_video.ptz_gateway",
  "milestone.xprotect",
] as const;

describe("standalone video/media addon SKUs", () => {
  it("registers every standalone key in ADDON_KEYS and ADDON_CATALOG", () => {
    for (const key of STANDALONE_VIDEO_KEYS) {
      expect(ADDON_KEYS).toContain(key);
      expect(ADDON_CATALOG.some((a) => a.key === key)).toBe(true);
      expect(getAddonByKey(key).key).toBe(key);
    }
  });

  it("has pricing-defaults for Features Catalog commercial keys", () => {
    expect(PRICING_DEFAULTS["caller_media.video_assist"]).toBe(2500);
    expect(PRICING_DEFAULTS["caller_media.live_video_kvs"]).toBe(5000);
    expect(PRICING_DEFAULTS["vision.iq_vision"]).toBe(3500);
    expect(PRICING_DEFAULTS["connect.nest"]).toBe(750);
    expect(PRICING_DEFAULTS["connect.wyze"]).toBe(750);
    expect(PRICING_DEFAULTS["rc_video.wall"]).toBe(2000);
    expect(PRICING_DEFAULTS["milestone.xprotect"]).toBe(2500);
  });

  it("relabels facility camera packs away from iQ Vision naming", () => {
    expect(getAddonByKey("feature_addons.rc_connect_standard").name).toMatch(/Facility cameras/i);
    expect(getAddonByKey("feature_addons.rc_connect_professional").name).toMatch(/Facility cameras/i);
    expect(getAddonByKey("feature_addons.rc_connect_enterprise").name).toMatch(/Facility cameras/i);
  });
});

import { describe, expect, it } from "vitest";
import { agencySatisfiesAddonFamily, hasFamilyMatch } from "./requireAddon.js";

describe("video/media requireAddon families", () => {
  it("matches exact standalone SKUs", () => {
    expect(hasFamilyMatch(["caller_media.video_assist"], "caller_media.video_assist")).toBe(true);
    expect(hasFamilyMatch(["caller_media.live_video_kvs"], "caller_media.live_video_kvs")).toBe(true);
    expect(hasFamilyMatch(["vision.iq_vision"], "vision.iq_vision")).toBe(true);
    expect(hasFamilyMatch(["connect.nest"], "connect.nest")).toBe(true);
    expect(hasFamilyMatch(["connect.wyze"], "connect.wyze")).toBe(true);
    expect(hasFamilyMatch(["rc_video.wall"], "rc_video.wall")).toBe(true);
    expect(hasFamilyMatch(["rc_video.ptz_gateway"], "rc_video.ptz_gateway")).toBe(true);
    expect(hasFamilyMatch(["milestone.xprotect"], "milestone.xprotect")).toBe(true);
  });

  it("does not cross-entitle Nest vs Wyze", () => {
    expect(hasFamilyMatch(["connect.nest"], "connect.wyze")).toBe(false);
    expect(hasFamilyMatch(["connect.wyze"], "connect.nest")).toBe(false);
  });

  it("agencySatisfiesAddonFamily reads agency.addons list", () => {
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "vision.iq_vision",
        agencyAddons: ["vision.iq_vision"],
        planId: "essential",
      }),
    ).toBe(true);
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "vision.iq_vision",
        agencyAddons: ["connect.nest"],
        planId: "essential",
      }),
    ).toBe(false);
  });
});

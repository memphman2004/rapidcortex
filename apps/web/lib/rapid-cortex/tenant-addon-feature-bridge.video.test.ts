import { describe, expect, it } from "vitest";
import type { TenantEntitlements } from "rapid-cortex-shared";
import { rapidCortexFeatureIdsFromTenantEntitlements } from "./tenant-addon-feature-bridge";

function seedEntitlements(partial: Partial<TenantEntitlements>): TenantEntitlements {
  return {
    tenantId: "agency-1",
    plan: "essential",
    addons: {} as TenantEntitlements["addons"],
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "test@example.com",
    schemaVersion: 1,
    ...partial,
  };
}

describe("tenant-addon-feature-bridge video/media", () => {
  it("maps video assist and live video KVS to registry feature ids", () => {
    const ids = rapidCortexFeatureIdsFromTenantEntitlements(
      seedEntitlements({
        addons: {
          "caller_media.video_assist": { key: "caller_media.video_assist", enabled: true },
          "caller_media.live_video_kvs": { key: "caller_media.live_video_kvs", enabled: true },
        } as TenantEntitlements["addons"],
      }),
    );
    expect(ids).toEqual(
      expect.arrayContaining(["video_assist", "live_video_kvs", "live_caller_media_streaming"]),
    );
  });

  it("maps Nest / Wyze / Vision / wall / Milestone separately", () => {
    const ids = rapidCortexFeatureIdsFromTenantEntitlements(
      seedEntitlements({
        addons: {
          "vision.iq_vision": { key: "vision.iq_vision", enabled: true },
          "connect.nest": { key: "connect.nest", enabled: true },
          "connect.wyze": { key: "connect.wyze", enabled: true },
          "rc_video.wall": { key: "rc_video.wall", enabled: true },
          "milestone.xprotect": { key: "milestone.xprotect", enabled: true },
        } as TenantEntitlements["addons"],
      }),
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "iq_vision",
        "nest_connect",
        "wyze_connect",
        "rc_video_wall",
        "milestone_xprotect",
      ]),
    );
  });
});

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoleNav } from "./role-nav";

describe("transit cameras / video-wall dedicated pages", () => {
  it("nav hrefs point at dedicated routes", () => {
    const items = getRoleNav("TRANSIT_ADMIN", { transitCode: "HVT" }).sections.flatMap(
      (s) => s.items,
    );
    expect(items.find((i) => i.id === "cameras")?.href).toBe("/transit/HVT/cameras");
    expect(items.find((i) => i.id === "video-wall")?.href).toBe("/transit/HVT/video-wall");
  });

  it("dedicated page modules exist (not catch-all only)", () => {
    const root = join(process.cwd(), "app/transit/[transitCode]");
    // Vitest for apps/web usually runs with cwd = apps/web
    const cameras = existsSync(join(root, "cameras/page.tsx"))
      ? join(root, "cameras/page.tsx")
      : join(process.cwd(), "apps/web/app/transit/[transitCode]/cameras/page.tsx");
    const wall = existsSync(join(root, "video-wall/page.tsx"))
      ? join(root, "video-wall/page.tsx")
      : join(process.cwd(), "apps/web/app/transit/[transitCode]/video-wall/page.tsx");
    expect(existsSync(cameras)).toBe(true);
    expect(existsSync(wall)).toBe(true);
  });
});

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadStaffGuideArticles } from "./load-articles";
import {
  STAFF_GUIDE_ACCESS,
  findStaffGuideArticle,
  flattenStaffGuideArticles,
  getStaffGuideIndex,
  isStaffGuideRole,
  positionForRole,
  staffGuideVerticalFromRole,
} from "./catalog";

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), "../../public/staff-guide");

describe("staff guide catalog", () => {
  it("is unlimited and is not 911 help", () => {
    expect(STAFF_GUIDE_ACCESS.unlimited).toBe(true);
    expect(STAFF_GUIDE_ACCESS.quota).toBeNull();
    expect(isStaffGuideRole("dispatcher")).toBe(false);
    expect(isStaffGuideRole("supervisor")).toBe(false);
    expect(staffGuideVerticalFromRole("CAMPUS_ADMIN")).toBe("campus");
    expect(staffGuideVerticalFromRole("VENUE_GUEST_SERVICES")).toBe("venue");
    expect(staffGuideVerticalFromRole("transit_operator")).toBe("transit");
  });

  it("lists every campus, venue, and transit position plus QR/NFC and location delete", () => {
    for (const vertical of ["campus", "venue", "transit"] as const) {
      const topics = flattenStaffGuideArticles(vertical).map((article) => article.topic);
      expect(topics).toContain("overview");
      expect(topics).toContain("onboarding");
      expect(topics).toContain("position-admin");
      expect(topics).toContain("qr-nfc-update");
      expect(topics).toContain("delete-locations");
      expect(topics).toContain("when-to-call-911");
      expect(topics).toContain("incidents");
      expect(topics).toContain("cameras");
      expect(topics).toContain("qr-codes");
      expect(getStaffGuideIndex(vertical).some((section) => section.section === "How to use the console")).toBe(
        true,
      );
      expect(findStaffGuideArticle(vertical, "qr-nfc-update")?.shared).toBe(true);
      expect(findStaffGuideArticle(vertical, "delete-locations")?.shared).toBe(true);
      expect(getStaffGuideIndex(vertical).length).toBeGreaterThan(2);
    }
    expect(positionForRole("campus", "CAMPUS_DISPATCH")?.topic).toBe("position-dispatch");
    expect(positionForRole("venue", "venue_operator")?.topic).toBe("position-operator");
    expect(positionForRole("transit", "TRANSIT_SECURITY")?.topic).toBe("position-security");
  });

  it("renders venue and campus articles from disk", () => {
    const venue = loadStaffGuideArticles("venue");
    const campus = loadStaffGuideArticles("campus");
    expect(venue.onboarding).toContain("Day one");
    expect(venue["position-guest-services"].toLowerCase()).toContain("not a 911");
    expect(campus.onboarding).toContain("Day one");
    expect(campus["position-counselor"].toLowerCase()).toContain("wellness");
    expect(Object.keys(venue).length).toBe(flattenStaffGuideArticles("venue").length);
    expect(Object.keys(campus).length).toBe(flattenStaffGuideArticles("campus").length);
  });

  it("ships a markdown file on disk for every catalog article", () => {
    for (const vertical of ["campus", "venue", "transit"] as const) {
      for (const article of flattenStaffGuideArticles(vertical)) {
        const rel = article.shared
          ? join("shared", `${article.topic}.md`)
          : join(vertical, `${article.topic}.md`);
        expect(existsSync(join(publicRoot, rel)), rel).toBe(true);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  campusInfoTabSchema,
  resolveCampusInfoTab,
  toPublicCampusInfoTab,
} from "./info-tab.js";

describe("campusInfoTabSchema", () => {
  it("accepts a full info tab", () => {
    const parsed = campusInfoTabSchema.parse({
      displayName: "Riverside Community College",
      logoUrl: "https://cdn.example.com/logo.png",
      brandColor: "#0F766E",
      emergencyContacts: [{ label: "Campus Police", phone: "901-555-0100" }],
      sections: [
        { title: "Evacuation", content: "Exit via **Main Entrance**.", order: 0, visible: true },
      ],
      alertBanner: { message: "Weather alert", severity: "warning", active: true },
      externalLinks: [{ label: "Emergency page", url: "https://example.edu/emergency" }],
    });
    expect(parsed.displayName).toBe("Riverside Community College");
  });

  it("rejects http logo URLs", () => {
    expect(() =>
      campusInfoTabSchema.parse({ logoUrl: "http://cdn.example.com/logo.png" }),
    ).toThrow();
  });
});

describe("resolveCampusInfoTab", () => {
  it("prefers site override over tenant default", () => {
    const tab = resolveCampusInfoTab(
      {
        infoTab: { displayName: "Default Campus" },
        infoTabBySiteCode: {
          NORTH: { displayName: "North Annex" },
        },
      },
      "north",
    );
    expect(tab?.displayName).toBe("North Annex");
  });

  it("falls back to tenant default when site missing", () => {
    const tab = resolveCampusInfoTab(
      {
        infoTab: { displayName: "Default Campus" },
        infoTabBySiteCode: {},
      },
      "SOUTH",
    );
    expect(tab?.displayName).toBe("Default Campus");
  });
});

describe("toPublicCampusInfoTab", () => {
  it("omits invisible sections and inactive banners", () => {
    const pub = toPublicCampusInfoTab({
      displayName: "Campus",
      sections: [
        { title: "Hidden", content: "x", order: 0, visible: false },
        { title: "Visible", content: "y", order: 1, visible: true },
      ],
      alertBanner: { message: "Old", severity: "info", active: false },
    });
    expect(pub?.sections).toHaveLength(1);
    expect(pub?.sections?.[0]?.title).toBe("Visible");
    expect(pub?.alertBanner).toBeUndefined();
  });
});

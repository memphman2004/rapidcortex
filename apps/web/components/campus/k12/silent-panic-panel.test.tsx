import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CampusBuildingSummary, CampusSite } from "rapid-cortex-shared";
import type { CampusIncident } from "@/lib/campus/types";
import { SilentPanicPanel } from "./silent-panic-panel";

const site: CampusSite = {
  code: "CCHS",
  name: "Camden High",
  shortName: "CCHS",
  active: true,
};

const building: CampusBuildingSummary = {
  buildingId: "main",
  buildingName: "Main",
  zone: "A",
  occupancy: null,
  status: "nominal",
  activeIncidents: 0,
  siteCode: "CCHS",
};

const drill = {
  id: "inc-1",
  campusCode: "CAMDEN",
  buildingCode: "Main",
  buildingLabel: "Main",
  floor: null,
  roomCode: "",
  zoneLabel: "Camden High · Main",
  type: "active_threat",
  source: "manual",
  status: "open",
  description: "DRILL",
  isAnonymous: false,
  confidential: false,
  assignedTo: null,
  assignedToName: null,
  hasMedia: false,
  mediaUrls: [],
  createdAt: "2026-10-20T12:00:00.000Z",
  updatedAt: "2026-10-20T12:00:00.000Z",
  resolvedAt: null,
  silentPanic: {
    mode: "drill",
    schoolName: "Camden High",
    buildingName: "Main",
    activatedByName: "Alex Rivera",
  },
} as CampusIncident;

describe("SilentPanicPanel", () => {
  it("shows the control, the drill, and the district gaps", () => {
    const html = renderToStaticMarkup(
      createElement(SilentPanicPanel, {
        campusCode: "CAMDEN",
        actorName: "Alex Rivera",
        sites: [site],
        buildings: [building],
        incidents: [drill],
        canActivate: true,
        canOperate: true,
        onChanged: () => undefined,
      }),
    );
    expect(html).toContain("SILENT PANIC");
    expect(html).toContain("No siren. No public announcement. Does not call 911.");
    expect(html).toContain("What the district still has to finish");
    expect(html).toContain("does not place a 911 call");
    expect(html).toContain("DRILL");
    expect(html).toContain("Acknowledge");
    expect(html).toContain("Camden High");
  });

  it("hides the button from seats that cannot activate", () => {
    const html = renderToStaticMarkup(
      createElement(SilentPanicPanel, {
        campusCode: "UGA",
        actorName: "Pat",
        sites: [],
        buildings: [],
        incidents: [],
        canActivate: false,
        canOperate: false,
        onChanged: () => undefined,
      }),
    );
    expect(html).not.toContain("Activate silent panic");
    expect(html).toContain("Campus admin, security, and dispatch");
    expect(html).toContain("What this product does");
  });
});

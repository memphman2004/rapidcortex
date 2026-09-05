import { describe, expect, it } from "vitest";
import {
  BUNDLED_ONBOARDING_PACKETS,
  bundledPacketS3Key,
  canViewOnboardingPacketVertical,
  isSafeOnboardingPacketKey,
  onboardingPacketDownloadBodySchema,
  onboardingPacketVerticalsForRole,
} from "./onboarding-packets.js";

describe("onboarding packet verticals", () => {
  it("gives RC superadmin and RC admin every vertical folder", () => {
    expect(onboardingPacketVerticalsForRole("rcsuperadmin")).toEqual([
      "campus",
      "venue",
      "hospital",
      "transit",
      "psap",
    ]);
    expect(onboardingPacketVerticalsForRole("rcadmin")).toHaveLength(5);
  });

  it("scopes campus admin to campus only", () => {
    expect(onboardingPacketVerticalsForRole("CAMPUS_ADMIN")).toEqual(["campus"]);
    expect(canViewOnboardingPacketVertical("CAMPUS_ADMIN", "psap")).toBe(false);
    expect(canViewOnboardingPacketVertical("agencyadmin", "psap")).toBe(true);
  });

  it("denies dispatchers", () => {
    expect(onboardingPacketVerticalsForRole("dispatcher")).toEqual([]);
  });
});

describe("isSafeOnboardingPacketKey", () => {
  it("accepts keys under the vertical prefix", () => {
    expect(isSafeOnboardingPacketKey("onboarding-packets/campus/00-overview.md", "campus")).toBe(
      true,
    );
  });

  it("rejects traversal and other verticals", () => {
    expect(isSafeOnboardingPacketKey("onboarding-packets/campus/../psap/secret.md", "campus")).toBe(
      false,
    );
    expect(isSafeOnboardingPacketKey("onboarding-packets/psap/00-overview.md", "campus")).toBe(
      false,
    );
  });
});

describe("bundled packets", () => {
  it("includes a campus folder with go-live and integration limits", () => {
    const campus = BUNDLED_ONBOARDING_PACKETS.find((folder) => folder.vertical === "campus");
    expect(campus?.files.map((file) => file.fileName)).toContain("00-overview.md");
    expect(campus?.files.some((file) => file.markdown.includes("never auto-locks"))).toBe(true);
    expect(bundledPacketS3Key("campus", "00-overview.md")).toBe(
      "onboarding-packets/campus/00-overview.md",
    );
  });

  it("rejects download bodies with extra keys", () => {
    expect(
      onboardingPacketDownloadBodySchema.safeParse({
        vertical: "campus",
        key: "onboarding-packets/campus/00-overview.md",
        extra: true,
      }).success,
    ).toBe(false);
  });
});

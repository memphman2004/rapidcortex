import { describe, expect, it } from "vitest";
import {
  cadGrantForIdentity,
  cadSeatsRemaining,
  countCadSeats,
  defaultCadScope,
  isCadConsoleVisible,
  nextAgencyCadFeature,
  nextCadUserGrants,
  type AgencyCADFeature,
  type CadUserGrant,
} from "./access.js";

const NOW = "2026-10-24T12:00:00.000Z";

function feature(partial: Partial<AgencyCADFeature> & Pick<AgencyCADFeature, "enabled" | "maxCadSeats">): AgencyCADFeature {
  return partial;
}

function grant(username: string, cad: boolean): CadUserGrant {
  return { username, modules: cad ? ["CAD"] : [], cadScope: cad ? "FULL" : null };
}

describe("CAD module access", () => {
  it("hides the console until the agency license and the user seat are both on", () => {
    const licensed = feature({ enabled: true, maxCadSeats: 5 });
    expect(isCadConsoleVisible(undefined, grant("a", true))).toBe(false);
    expect(isCadConsoleVisible(feature({ enabled: false, maxCadSeats: 5 }), grant("a", true))).toBe(false);
    expect(isCadConsoleVisible(licensed, grant("a", false))).toBe(false);
    expect(isCadConsoleVisible(licensed, grant("a", true))).toBe(true);
  });

  it("defaults scope from the role", () => {
    expect(defaultCadScope("dispatcher")).toBe("FULL");
    expect(defaultCadScope("supervisor")).toBe("FULL");
    expect(defaultCadScope("agencyadmin")).toBe("ADMIN");
    expect(defaultCadScope("rcsuperadmin")).toBe("ADMIN");
    expect(defaultCadScope("analyst")).toBe("READ_ONLY");
  });

  it("counts assigned seats and remaining capacity", () => {
    const grants = { a: grant("a", true), b: grant("b", false), c: grant("c", true) };
    expect(countCadSeats(grants)).toBe(2);
    expect(cadSeatsRemaining(feature({ enabled: true, maxCadSeats: 3 }), 2)).toBe(1);
    expect(cadSeatsRemaining(feature({ enabled: false, maxCadSeats: 3 }), 2)).toBe(0);
  });

  it("matches a seat by username, email, or user id", () => {
    const grants = {
      "ada@psap.gov": grant("ada@psap.gov", true),
    };
    expect(cadGrantForIdentity(grants, { email: "ada@psap.gov" })?.username).toBe("ada@psap.gov");
    expect(cadGrantForIdentity(grants, { cognitoUsername: "ada@psap.gov" })?.modules).toEqual(["CAD"]);
    expect(cadGrantForIdentity(grants, { userId: "sub-1" })).toBeNull();
  });

  it("requires the agency name before disabling while seats are assigned", () => {
    const current = feature({ enabled: true, maxCadSeats: 4, enabledAt: NOW, enabledBy: "admin" });
    const blocked = nextAgencyCadFeature({
      current,
      enabled: false,
      actorId: "rc-1",
      now: NOW,
      seatCount: 2,
      agencyName: "Metro ECC",
    });
    expect(blocked).toEqual({ error: "CONFIRM" });

    const disabled = nextAgencyCadFeature({
      current,
      enabled: false,
      actorId: "rc-1",
      now: NOW,
      seatCount: 2,
      agencyName: "Metro ECC",
      confirmAgencyName: "metro ecc",
    });
    expect(disabled).toMatchObject({ action: "disabled", feature: { enabled: false, maxCadSeats: 4 } });
  });

  it("refuses a seat cap below the number of assigned users", () => {
    const result = nextAgencyCadFeature({
      current: feature({ enabled: true, maxCadSeats: 4 }),
      maxCadSeats: 1,
      actorId: "rc-1",
      now: NOW,
      seatCount: 2,
      agencyName: "Metro ECC",
    });
    expect(result).toEqual({ error: "SEAT_CAP" });
  });

  it("blocks a new seat when the agency is off or the cap is full, and keeps other modules", () => {
    const off = nextCadUserGrants({
      grants: {},
      username: "ada",
      enabled: true,
      cadScope: "FULL",
      feature: feature({ enabled: false, maxCadSeats: 2 }),
      now: NOW,
      actorId: "admin",
    });
    expect(off).toEqual({ error: "CAD_DISABLED" });

    const full = nextCadUserGrants({
      grants: { a: grant("a", true) },
      username: "b",
      enabled: true,
      cadScope: "READ_ONLY",
      feature: feature({ enabled: true, maxCadSeats: 1 }),
      now: NOW,
      actorId: "admin",
    });
    expect(full).toEqual({ error: "SEAT_LIMIT" });

    const revoked = nextCadUserGrants({
      grants: { ada: { username: "ada", modules: ["CAD", "AI_ASSIST"], cadScope: "FULL" } },
      username: "ada",
      enabled: false,
      cadScope: "FULL",
      feature: feature({ enabled: true, maxCadSeats: 2 }),
      now: NOW,
      actorId: "admin",
    });
    expect(revoked).toMatchObject({
      assigned: false,
      grants: { ada: { modules: ["AI_ASSIST"], cadScope: null } },
    });
  });

  it("does not consume a second seat when the user already has CAD", () => {
    const result = nextCadUserGrants({
      grants: { ada: grant("ada", true) },
      username: "ada",
      enabled: true,
      cadScope: "ADMIN",
      feature: feature({ enabled: true, maxCadSeats: 1 }),
      now: NOW,
      actorId: "admin",
    });
    expect(result).toMatchObject({ assigned: true, grants: { ada: { cadScope: "ADMIN" } } });
  });
});

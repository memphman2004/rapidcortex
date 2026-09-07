import { describe, expect, it } from "vitest";
import { provisionableRolesForActor } from "./provisionable-roles";

describe("provisionableRolesForActor", () => {
  it("lets transit admin assign transit roles only", () => {
    expect(provisionableRolesForActor("TRANSIT_ADMIN")).toEqual([
      "TRANSIT_ADMIN",
      "TRANSIT_SUPERVISOR",
      "TRANSIT_SECURITY",
      "TRANSIT_OPERATOR",
    ]);
    expect(provisionableRolesForActor("transit_admin")).toEqual(
      provisionableRolesForActor("TRANSIT_ADMIN"),
    );
  });

  it("does not let transit supervisor provision users", () => {
    expect(provisionableRolesForActor("TRANSIT_SUPERVISOR")).not.toContain("TRANSIT_ADMIN");
  });
});

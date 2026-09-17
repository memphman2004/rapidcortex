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

  it("lets Call Assist admin assign Call Assist roles only", () => {
    expect(provisionableRolesForActor("CALL_ASSIST_ADMIN")).toEqual([
      "CALL_ASSIST_ADMIN",
      "CALL_ASSIST_SUPERVISOR",
      "CALL_ASSIST_OPERATOR",
    ]);
    expect(provisionableRolesForActor("call_assist_admin")).toEqual(
      provisionableRolesForActor("CALL_ASSIST_ADMIN"),
    );
  });
});

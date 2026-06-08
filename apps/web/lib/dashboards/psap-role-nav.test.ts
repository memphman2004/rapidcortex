import { describe, expect, it } from "vitest";
import {
  AGENCY_ADMIN_ADMIN_NAV,
  ANALYST_OPS_NAV,
  AUDITOR_OPS_NAV,
  DISPATCHER_OPS_NAV,
  psapAdministrationNavForRole,
  psapOperationsNavForRole,
  SUPERVISOR_OPS_NAV,
} from "./psap-role-nav";

describe("psap role navigation", () => {
  it("scopes dispatcher to live workspace paths only", () => {
    const paths = psapOperationsNavForRole("dispatcher").map((i) => i.path);
    expect(paths).toEqual(DISPATCHER_OPS_NAV.map((i) => i.path));
    expect(paths).toContain("/dashboard");
    expect(paths).not.toContain("/admin");
  });

  it("scopes supervisor to command paths", () => {
    expect(psapOperationsNavForRole("supervisor").map((i) => i.path)).toEqual(
      SUPERVISOR_OPS_NAV.map((i) => i.path),
    );
  });

  it("keeps agencyadmin out of live ops", () => {
    const paths = psapOperationsNavForRole("agencyadmin").map((i) => i.path);
    expect(paths).not.toContain("/dashboard");
    expect(paths).not.toContain("/transcription");
    expect(psapAdministrationNavForRole("agencyadmin").map((i) => i.path)).toEqual(
      AGENCY_ADMIN_ADMIN_NAV.map((i) => i.path),
    );
  });

  it("scopes agencyit to technical console", () => {
    const paths = psapOperationsNavForRole("agencyit").map((i) => i.path);
    expect(paths[0]).toBe("/admin/it");
    expect(paths).not.toContain("/admin/billing");
    expect(psapAdministrationNavForRole("agencyit")).toEqual([]);
  });

  it("scopes analyst and auditor away from dispatch", () => {
    expect(psapOperationsNavForRole("analyst").map((i) => i.path)).toEqual(
      ANALYST_OPS_NAV.map((i) => i.path),
    );
    expect(psapOperationsNavForRole("auditor").map((i) => i.path)).toEqual(
      AUDITOR_OPS_NAV.map((i) => i.path),
    );
  });
});

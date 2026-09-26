import { describe, expect, it } from "vitest";
import { canAccessContactsModule } from "../contacts/schemas.js";
import {
  canAccessDeploymentsMap,
  canAccessGrantSuccessProgram,
  canAccessPsapProspectsCrm,
  canAccessRapidIqWorkspace,
} from "./sales-contractor-access.js";
import { salesContractorMayAccessPath } from "./sales-contractor-paths.js";

describe("salesContractorMayAccessPath", () => {
  it("allows /sales and allowlisted /rc-admin tools", () => {
    expect(salesContractorMayAccessPath("/sales")).toBe(true);
    expect(salesContractorMayAccessPath("/sales/pricing-catalog")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/psap-prospects")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/contacts")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/billing")).toBe(false);
    expect(salesContractorMayAccessPath("/rc-admin/users")).toBe(false);
  });
});

describe("sales contractor CRM access helpers", () => {
  it("grants contacts, psap, deployments, nexiq, and grant success to sales", () => {
    expect(canAccessContactsModule("salescontractor")).toBe(true);
    expect(canAccessPsapProspectsCrm("salescontractor")).toBe(true);
    expect(canAccessDeploymentsMap("salescontractor")).toBe(true);
    expect(canAccessRapidIqWorkspace("salescontractor")).toBe(true);
    expect(canAccessGrantSuccessProgram("salescontractor")).toBe(true);
  });

  it("keeps rcitadmin off Rapid IQ workspace", () => {
    expect(canAccessRapidIqWorkspace("rcitadmin")).toBe(false);
  });
});

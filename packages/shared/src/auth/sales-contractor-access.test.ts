import { describe, expect, it } from "vitest";
import { canAccessContactsModule } from "../contacts/schemas.js";
import {
  canAccessSalesAutomation,
  canManageSalesAutomation,
} from "../rapid-iq/schemas.js";
import {
  canAccessDeploymentsMap,
  canAccessGrantSuccessProgram,
  canAccessPricingCatalog,
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
    expect(salesContractorMayAccessPath("/rc-admin/sales-automation")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/nexiq/intel/sources")).toBe(true);
    expect(salesContractorMayAccessPath("/docs/rapidcortex-complete-manual.html")).toBe(true);
    expect(salesContractorMayAccessPath("/docs/RC_NFC_QR_Setup_Guide.pdf")).toBe(true);
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
    expect(canAccessPricingCatalog("salescontractor")).toBe(true);
    expect(canAccessPricingCatalog("rcadmin")).toBe(true);
    expect(canAccessPricingCatalog("dispatcher")).toBe(false);
  });

  it("keeps rcitadmin off NexiQ workspace", () => {
    expect(canAccessRapidIqWorkspace("rcitadmin")).toBe(false);
  });

  it("lets sales view email campaigns but not approve or edit", () => {
    expect(canAccessSalesAutomation("salescontractor")).toBe(true);
    expect(canManageSalesAutomation("salescontractor")).toBe(false);
    expect(canManageSalesAutomation("rcadmin")).toBe(true);
    expect(canManageSalesAutomation("rcsuperadmin")).toBe(true);
  });
});

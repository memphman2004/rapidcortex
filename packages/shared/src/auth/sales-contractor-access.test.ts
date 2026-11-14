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
  canAccessNexiqSignalsPanel,
  canAccessPsapProspectsCrm,
  canAccessRapidIqWorkspace,
} from "./sales-contractor-access.js";
import { canAccessNexiqSignals } from "../nexiq-signals/schemas.js";
import { salesContractorMayAccessApiPath, salesContractorMayAccessPath } from "./sales-contractor-paths.js";

describe("salesContractorMayAccessApiPath", () => {
  it("allows NFC-cards and personal business-card API paths", () => {
    expect(salesContractorMayAccessApiPath("/api/admin/nfc-cards")).toBe(true);
    expect(salesContractorMayAccessApiPath("/api/admin/nfc-cards/abc123")).toBe(true);
    expect(salesContractorMayAccessApiPath("/api/admin/nfc-cards/abc123/status")).toBe(true);
    expect(salesContractorMayAccessApiPath("/api/business-cards/me")).toBe(true);
    expect(salesContractorMayAccessApiPath("/api/business-cards/me/photo")).toBe(true);
    expect(salesContractorMayAccessApiPath("/api/business-cards/me/publish")).toBe(true);
    expect(salesContractorMayAccessApiPath("/api/business-cards/me/qr")).toBe(true);
    expect(salesContractorMayAccessApiPath("/api/business-cards/status")).toBe(true);
  });
  it("blocks /api/admin/business-cards (requireAdmin rejects salescontractor)", () => {
    // listAdmin / archiveProfile / updateSettings all require BUSINESS_CARD_ADMIN_ROLES
    // which is {rcsuperadmin, rcadmin} — salescontractor is not included.
    expect(salesContractorMayAccessApiPath("/api/admin/business-cards")).toBe(false);
    expect(salesContractorMayAccessApiPath("/api/admin/business-cards/settings")).toBe(false);
    expect(salesContractorMayAccessApiPath("/api/admin/business-cards/staff")).toBe(false);
  });
  it("blocks unrelated API paths", () => {
    expect(salesContractorMayAccessApiPath("/api/incidents")).toBe(false);
    expect(salesContractorMayAccessApiPath("/api/admin/users")).toBe(false);
    expect(salesContractorMayAccessApiPath("/api/admin/cad-incidents")).toBe(false);
  });
});

describe("salesContractorMayAccessPath", () => {
  it("allows /sales and allowlisted /rc-admin tools", () => {
    expect(salesContractorMayAccessPath("/sales")).toBe(true);
    expect(salesContractorMayAccessPath("/sales/features-catalog")).toBe(true);
    expect(salesContractorMayAccessPath("/sales/pricing-catalog")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/psap-prospects")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/contacts")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/sales-automation")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/email-list")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/marketing")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/marketing/campaigns")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/marketing/leads")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/marketing/email")).toBe(true);
    expect(salesContractorMayAccessPath("/rc-admin/marketing/events")).toBe(true);
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

  it("opens the NexiQ workspace to every RC internal role", () => {
    expect(canAccessRapidIqWorkspace("rcsuperadmin")).toBe(true);
    expect(canAccessRapidIqWorkspace("rcadmin")).toBe(true);
    expect(canAccessRapidIqWorkspace("rcitadmin")).toBe(true);
    expect(canAccessRapidIqWorkspace("dispatcher")).toBe(false);
  });

  it("aligns NexiQ Signals access with workspace roles", () => {
    expect(canAccessNexiqSignals("salescontractor")).toBe(true);
    expect(canAccessNexiqSignalsPanel("salescontractor")).toBe(true);
    expect(canAccessNexiqSignals("rcitadmin")).toBe(true);
    expect(canAccessNexiqSignals("dispatcher")).toBe(false);
  });

  it("lets sales view email campaigns but not approve or edit", () => {
    expect(canAccessSalesAutomation("salescontractor")).toBe(true);
    expect(canManageSalesAutomation("salescontractor")).toBe(false);
    expect(canManageSalesAutomation("rcadmin")).toBe(true);
    expect(canManageSalesAutomation("rcsuperadmin")).toBe(true);
  });
});

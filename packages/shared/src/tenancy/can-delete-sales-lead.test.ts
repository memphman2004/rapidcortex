import { describe, expect, it } from "vitest";
import { canDeleteSalesLead } from "./principal.js";

describe("canDeleteSalesLead", () => {
  it("allows RC admin and RC superadmin", () => {
    expect(canDeleteSalesLead("rcadmin")).toBe(true);
    expect(canDeleteSalesLead("rcsuperadmin")).toBe(true);
  });

  it("blocks sales contractors and other RC staff", () => {
    expect(canDeleteSalesLead("salescontractor")).toBe(false);
    expect(canDeleteSalesLead("rcitadmin")).toBe(false);
    expect(canDeleteSalesLead("dispatcher")).toBe(false);
  });
});

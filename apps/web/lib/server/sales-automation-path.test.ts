import { describe, expect, it } from "vitest";
import { salesAutomationPathRequiresManage } from "./sales-automation-path";

describe("salesAutomationPathRequiresManage", () => {
  it("allows sales contractors to list and create drafts", () => {
    expect(salesAutomationPathRequiresManage("GET", ["sequences"])).toBe(false);
    expect(salesAutomationPathRequiresManage("GET", ["metrics"])).toBe(false);
    expect(salesAutomationPathRequiresManage("GET", ["outlook", "status"])).toBe(false);
    expect(salesAutomationPathRequiresManage("POST", ["sequences"])).toBe(false);
    expect(salesAutomationPathRequiresManage("POST", ["bulk"])).toBe(false);
  });

  it("requires manage for approve, suppress, edit, and Outlook connect", () => {
    expect(salesAutomationPathRequiresManage("POST", ["sequences", "x", "approve"])).toBe(true);
    expect(salesAutomationPathRequiresManage("POST", ["bulk", "approve"])).toBe(true);
    expect(salesAutomationPathRequiresManage("POST", ["sequences", "x", "suppress"])).toBe(true);
    expect(salesAutomationPathRequiresManage("PATCH", ["sequences", "x"])).toBe(true);
    expect(salesAutomationPathRequiresManage("GET", ["outlook", "connect"])).toBe(true);
    expect(salesAutomationPathRequiresManage("POST", ["outlook", "disconnect"])).toBe(true);
  });
});

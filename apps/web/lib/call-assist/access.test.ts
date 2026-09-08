import { describe, expect, it } from "vitest";
import { canAdminCallAssist, canRunCallAssistDemo, canSeeAgencySwitcher, canSetCallAssistVertical, canViewCallAssist } from "./access";

describe("Call Assist web access", () => {
  it("lets dispatchers view and not administer", () => {
    expect(canViewCallAssist("dispatcher")).toBe(true);
    expect(canAdminCallAssist("dispatcher")).toBe(false);
    expect(canRunCallAssistDemo("dispatcher")).toBe(false);
  });

  it("lets agency admin run demo and config", () => {
    expect(canAdminCallAssist("agencyadmin")).toBe(true);
    expect(canRunCallAssistDemo("agencyadmin")).toBe(true);
    expect(canAdminCallAssist("rcitadmin")).toBe(true);
  });

  it("restricts operational profile selection to RC operators", () => {
    expect(canSetCallAssistVertical("agencyadmin")).toBe(false);
    expect(canSetCallAssistVertical("dispatcher")).toBe(false);
    expect(canSetCallAssistVertical("rcadmin")).toBe(true);
    expect(canSetCallAssistVertical("rcsuperadmin")).toBe(true);
    expect(canSetCallAssistVertical("rcitadmin")).toBe(true);
  });

  it("hides the agency switcher from customer roles", () => {
    expect(canSeeAgencySwitcher("dispatcher")).toBe(false);
    expect(canSeeAgencySwitcher("agencyadmin")).toBe(false);
    expect(canSeeAgencySwitcher("CAMPUS_ADMIN")).toBe(false);
    expect(canSeeAgencySwitcher("VENUE_ADMIN")).toBe(false);
    expect(canSeeAgencySwitcher("rcsuperadmin")).toBe(true);
    expect(canSeeAgencySwitcher("rcadmin")).toBe(true);
    expect(canSeeAgencySwitcher("rcitadmin")).toBe(true);
  });
});

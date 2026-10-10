import { describe, expect, it } from "vitest";
import { canManageGisDatasets, canViewGisLayers } from "./authz.js";

describe("gis authz", () => {
  it("allows agencyadmin to manage", () => {
    expect(canManageGisDatasets("agencyadmin")).toBe(true);
    expect(canManageGisDatasets("agencyit")).toBe(true);
    expect(canManageGisDatasets("rcsuperadmin")).toBe(true);
  });

  it("denies dispatcher manage but allows view", () => {
    expect(canManageGisDatasets("dispatcher")).toBe(false);
    expect(canViewGisLayers("dispatcher")).toBe(true);
    expect(canViewGisLayers("supervisor")).toBe(true);
  });

  it("denies salescontractor", () => {
    expect(canManageGisDatasets("salescontractor")).toBe(false);
    expect(canViewGisLayers("salescontractor")).toBe(false);
  });
});

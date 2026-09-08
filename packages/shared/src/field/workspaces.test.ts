import { describe, expect, it } from "vitest";
import {
  fieldAccessToolsRequestable,
  fieldDestinationForRole,
  fieldRoleHasDispatch911,
  fieldWorkspaceSingle,
  fieldWorkspacesForRole,
  normalizeFieldAccessToolId,
} from "./workspaces.js";

describe("field destination routing", () => {
  it("sends campus and venue operator roles to QR/NFC", () => {
    expect(fieldDestinationForRole("campus_admin")).toBe("qr_nfc");
    expect(fieldDestinationForRole("CAMPUS_ADMIN")).toBe("qr_nfc");
    expect(fieldDestinationForRole("campus_supervisor")).toBe("qr_nfc");
    expect(fieldDestinationForRole("venue_operator")).toBe("qr_nfc");
    expect(fieldDestinationForRole("transit_admin")).toBe("qr_nfc");
  });

  it("sends operational PSAP roles to dispatch", () => {
    expect(fieldDestinationForRole("supervisor")).toBe("dispatch");
    expect(fieldDestinationForRole("dispatcher")).toBe("dispatch");
    expect(fieldDestinationForRole("analyst")).toBe("dispatch");
  });

  it("treats leftover commsupervisor JWT values as supervisor", () => {
    expect(fieldDestinationForRole("commsupervisor")).toBe("dispatch");
    expect(fieldDestinationForRole("COMMSUPERVISOR")).toBe("dispatch");
    expect(fieldRoleHasDispatch911("commsupervisor")).toBe(true);
    expect(fieldWorkspaceSingle("commsupervisor")).toBe("911-dispatch");
  });

  it("routes agencyadmin from agencyVertical, defaulting to QR/NFC", () => {
    expect(fieldDestinationForRole("agencyadmin")).toBe("qr_nfc");
    expect(fieldDestinationForRole("agencyadmin", "campus")).toBe("qr_nfc");
    expect(fieldDestinationForRole("agencyadmin", "venue")).toBe("qr_nfc");
    expect(fieldDestinationForRole("agencyadmin", "911")).toBe("dispatch");
    expect(fieldDestinationForRole("agencyadmin", "city")).toBe("dispatch");
  });

  it("sends RC platform roles to the agency selector", () => {
    expect(fieldDestinationForRole("rcsuperadmin")).toBe("agency_select");
    expect(fieldDestinationForRole("rcadmin")).toBe("agency_select");
    expect(fieldDestinationForRole("rcitadmin")).toBe("agency_select");
  });

  it("does not invent director and leaves unknown roles empty", () => {
    expect(fieldDestinationForRole("director")).toBe("no_access");
    expect(fieldWorkspacesForRole("director")).toEqual([]);
    expect(fieldWorkspacesForRole("hospital_staff")).toEqual([]);
  });
});

describe("field access tools", () => {
  it("lets campus_admin request operational dashboard, not QR they already have", () => {
    expect(fieldAccessToolsRequestable("campus_admin")).toEqual(["dispatch_ops"]);
    expect(normalizeFieldAccessToolId("911-dispatch")).toBe("dispatch_ops");
  });

  it("lets supervisor request QR/NFC tools", () => {
    expect(fieldAccessToolsRequestable("supervisor")).toEqual(["qr_nfc"]);
  });

  it("lets 911 agencyadmin request QR tools and campus agencyadmin request dispatch", () => {
    expect(fieldAccessToolsRequestable("agencyadmin", "911")).toEqual(["qr_nfc"]);
    expect(fieldAccessToolsRequestable("agencyadmin", "campus")).toEqual(["dispatch_ops"]);
  });

  it("does not offer access requests to platform admins", () => {
    expect(fieldAccessToolsRequestable("rcsuperadmin")).toEqual([]);
  });
});

describe("field Command API grants", () => {
  it("grants Command APIs to dispatch roles and agencyadmin, not campus_admin", () => {
    expect(fieldRoleHasDispatch911("supervisor")).toBe(true);
    expect(fieldRoleHasDispatch911("agencyadmin")).toBe(true);
    expect(fieldRoleHasDispatch911("campus_admin")).toBe(false);
    expect(fieldRoleHasDispatch911("campus_supervisor")).toBe(false);
  });
});

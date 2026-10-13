import { describe, expect, it } from "vitest";
import {
  canBrowseAllDocumentLibraries,
  documentLibraryVerticalIdsForRole,
  primaryDocumentLibraryVerticalForRole,
} from "./document-library-access";

describe("document-library-access", () => {
  it("allows full hub for platform roles only", () => {
    expect(canBrowseAllDocumentLibraries("rcsuperadmin")).toBe(true);
    expect(canBrowseAllDocumentLibraries("rcadmin")).toBe(true);
    expect(canBrowseAllDocumentLibraries("rcitadmin")).toBe(true);
    expect(canBrowseAllDocumentLibraries("dispatcher")).toBe(false);
    expect(canBrowseAllDocumentLibraries("salescontractor")).toBe(false);
    expect(canBrowseAllDocumentLibraries("campus_admin_k12")).toBe(false);
  });

  it("scopes product and PSAP roles to a single vertical", () => {
    expect(documentLibraryVerticalIdsForRole("dispatcher")).toEqual(["psap"]);
    expect(documentLibraryVerticalIdsForRole("agencyadmin")).toEqual(["psap"]);
    expect(documentLibraryVerticalIdsForRole("salescontractor")).toEqual(["sales"]);
    expect(documentLibraryVerticalIdsForRole("venue_admin")).toEqual(["venue"]);
    expect(documentLibraryVerticalIdsForRole("transit_operator")).toEqual(["transit"]);
    expect(documentLibraryVerticalIdsForRole("call_assist_admin")).toEqual(["call-assist"]);
    expect(documentLibraryVerticalIdsForRole("hospital_admin")).toEqual(["hospital"]);
  });

  it("returns primary vertical for non-platform roles", () => {
    expect(primaryDocumentLibraryVerticalForRole("dispatcher")?.id).toBe("psap");
    expect(primaryDocumentLibraryVerticalForRole("salescontractor")?.id).toBe("sales");
    expect(primaryDocumentLibraryVerticalForRole("rcsuperadmin")).toBeUndefined();
  });
});

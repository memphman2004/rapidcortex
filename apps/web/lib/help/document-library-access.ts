/**
 * Role → document-library vertical access.
 * Full hub (every vertical) is platform RC roles only.
 */

import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import {
  DOCUMENT_LIBRARY_VERTICALS,
  type DocumentLibraryVertical,
  type DocumentLibraryVerticalId,
} from "@/lib/help/document-library-verticals";

const PLATFORM_ROLES = new Set(["rcsuperadmin", "rcadmin", "rcitadmin"]);

const ALL_VERTICAL_IDS = DOCUMENT_LIBRARY_VERTICALS.map((v) => v.id);

function effectiveRole(role: string | null | undefined): string {
  const raw = String(role ?? "").trim();
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw;
}

/** True when the role may browse the multi-vertical Document Library hub. */
export function canBrowseAllDocumentLibraries(role: string | null | undefined): boolean {
  return PLATFORM_ROLES.has(effectiveRole(role));
}

/**
 * Vertical ids this role may open.
 * Platform → all; product / PSAP / sales → single matching vertical.
 */
export function documentLibraryVerticalIdsForRole(
  role: string | null | undefined,
): DocumentLibraryVerticalId[] {
  const e = effectiveRole(role);
  if (PLATFORM_ROLES.has(e)) return [...ALL_VERTICAL_IDS];

  if (e === "salescontractor") return ["sales"];

  if (
    e === "dispatcher" ||
    e === "supervisor" ||
    e === "agencyadmin" ||
    e === "agencyit" ||
    e === "analyst" ||
    e === "auditor"
  ) {
    return ["psap"];
  }

  if (e.startsWith("campus_")) return ["campus"];
  if (e.startsWith("venue_")) return ["venue"];
  if (e.startsWith("transit_")) return ["transit"];
  if (e.startsWith("hospital_") || e === "hospitaladmin" || e === "hospitalstaff") {
    return ["hospital"];
  }
  if (e.startsWith("call_assist_")) return ["call-assist"];

  // Unknown / unsupported — fail closed (no hub cards, no cross-vertical browse).
  return [];
}

export function documentLibraryVerticalsForRole(
  role: string | null | undefined,
): DocumentLibraryVertical[] {
  const allowed = new Set(documentLibraryVerticalIdsForRole(role));
  return DOCUMENT_LIBRARY_VERTICALS.filter((v) => allowed.has(v.id));
}

/** Single vertical for non-hub roles, or undefined when the role may browse the full hub. */
export function primaryDocumentLibraryVerticalForRole(
  role: string | null | undefined,
): DocumentLibraryVertical | undefined {
  if (canBrowseAllDocumentLibraries(role)) return undefined;
  return documentLibraryVerticalsForRole(role)[0];
}

/**
 * Vertical document libraries for RC Admin / Superadmin nav.
 * Each entry is a submenu destination under Document Library.
 */

import type { FlowId } from "@/lib/feature-architecture/flows";

export type DocumentLibraryVerticalId =
  | "platform"
  | "psap"
  | "campus"
  | "venue"
  | "transit"
  | "hospital"
  | "call-assist"
  | "sales";

export type DocumentLibraryVertical = {
  id: DocumentLibraryVerticalId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  icon: string;
  /** Help-content role key used to load that vertical's article index */
  helpRole: string;
  /** Architecture flow ids to surface (empty = all flows) */
  flowIds: FlowId[] | "all";
};

export const DOCUMENT_LIBRARY_VERTICALS: DocumentLibraryVertical[] = [
  {
    id: "platform",
    label: "Platform / RC Ops",
    shortLabel: "Platform",
    description: "Cross-product architecture maps, QR/NFC, media, vision, and RC operator references.",
    href: "/rc-admin/document-library/platform",
    icon: "Layers",
    helpRole: "rcadmin",
    flowIds: ["qr_nfc", "cad", "media_sms", "vision", "multilang", "translate", "asr", "cameras"],
  },
  {
    id: "psap",
    label: "PSAP / 911",
    shortLabel: "PSAP",
    description: "Dispatcher, supervisor, and agency-admin guides for live 911 operations.",
    href: "/rc-admin/document-library/psap",
    icon: "Radio",
    helpRole: "dispatcher",
    flowIds: ["psap_ai", "cad", "media_sms", "vision", "multilang", "translate", "asr", "cameras"],
  },
  {
    id: "campus",
    label: "Campus Safety",
    shortLabel: "Campus",
    description: "Campus console, Clery, EAP, K-12 pickup auth, and campus automation.",
    href: "/rc-admin/document-library/campus",
    icon: "GraduationCap",
    helpRole: "campus_admin",
    flowIds: ["campus_events", "clery_dcl", "eap", "automation", "k12", "pickup", "qr_nfc", "cameras"],
  },
  {
    id: "venue",
    label: "Venue Operations",
    shortLabel: "Venue",
    description: "Venue security, guest services, and QR/NFC incident intake.",
    href: "/rc-admin/document-library/venue",
    icon: "Building2",
    helpRole: "venue_admin",
    flowIds: ["venue_guest", "venue_qr", "qr_nfc", "cameras", "translate"],
  },
  {
    id: "transit",
    label: "Transit Operations",
    shortLabel: "Transit",
    description: "Transit QR intake, ops console, and place-based camera routing.",
    href: "/rc-admin/document-library/transit",
    icon: "Bus",
    helpRole: "transit_admin",
    flowIds: ["transit", "qr_nfc", "cameras", "translate"],
  },
  {
    id: "hospital",
    label: "Hospital Routing",
    shortLabel: "Hospital",
    description: "Capacity, diversion, and hospital staff/admin workflows.",
    href: "/rc-admin/document-library/hospital",
    icon: "HeartPulse",
    helpRole: "hospital_admin",
    flowIds: ["hospital"],
  },
  {
    id: "call-assist",
    label: "Nexiq",
    shortLabel: "Nexiq",
    description: "Non-emergency Nexiq intake, confirmation, and routing.",
    href: "/rc-admin/document-library/call-assist",
    icon: "PhoneIncoming",
    helpRole: "call_assist_admin",
    flowIds: ["ca_confirm", "ca_full"],
  },
  {
    id: "sales",
    label: "Sales & Enablement",
    shortLabel: "Sales",
    description: "Sales contractor library, demos, and commercial enablement docs.",
    /** In-shell sales library — /rc-admin/document-library/sales is platform-only. */
    href: "/sales/document-library",
    icon: "Briefcase",
    helpRole: "salescontractor",
    /** Enablement maps sales contractors walk in demos (not the full RC Ops catalog). */
    flowIds: [
      "psap_ai",
      "ca_confirm",
      "campus_events",
      "venue_guest",
      "transit",
      "hospital",
      "qr_nfc",
      "vision",
      "cad",
    ],
  },
];

export function getDocumentLibraryVertical(
  id: string | undefined | null,
): DocumentLibraryVertical | undefined {
  if (!id) return undefined;
  return DOCUMENT_LIBRARY_VERTICALS.find((v) => v.id === id);
}

export function isDocumentLibraryVerticalId(id: string): id is DocumentLibraryVerticalId {
  return DOCUMENT_LIBRARY_VERTICALS.some((v) => v.id === id);
}

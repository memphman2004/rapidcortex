import { DocumentLibraryClient } from "@/components/help/document-library-client";
import { requireRole } from "@/lib/auth/require-role";
import { getDocumentLibraryVertical } from "@/lib/help/document-library-verticals";

export const metadata = {
  title: "Document Library",
  robots: { index: false, follow: false },
};

/** Dispatcher / supervisor training and SOP document library — PSAP vertical only. */
export default async function JurisdictionOpsDocumentLibraryPage() {
  const user = await requireRole([
    "dispatcher",
    "supervisor",
    "agencyadmin",
    "agencyit",
    "analyst",
    "auditor",
    "rcsuperadmin",
    "rcadmin",
    "rcitadmin",
  ]);

  // Platform operators browsing from a jurisdiction route still get the PSAP ops library here;
  // the full multi-vertical hub stays under /rc-admin/document-library.
  const psap = getDocumentLibraryVertical("psap");

  return (
    <DocumentLibraryClient
      role={user.role}
      vertical={psap}
      subtitle="Training modules, SOPs, protocol guides, and curated platform documentation for dispatch operations."
    />
  );
}

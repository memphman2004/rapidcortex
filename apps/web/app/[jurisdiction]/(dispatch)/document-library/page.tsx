import { DocumentLibraryClient } from "@/components/help/document-library-client";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = {
  title: "Document Library",
  robots: { index: false, follow: false },
};

/** Dispatcher / supervisor training and SOP document library. */
export default async function JurisdictionOpsDocumentLibraryPage() {
  await requireRole([
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
  return (
    <DocumentLibraryClient subtitle="Training modules, SOPs, protocol guides, and curated platform documentation for dispatch operations." />
  );
}

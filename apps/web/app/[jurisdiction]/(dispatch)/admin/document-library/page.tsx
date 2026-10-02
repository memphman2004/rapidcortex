import { DocumentLibraryClient } from "@/components/help/document-library-client";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = {
  title: "Document Library",
  robots: { index: false, follow: false },
};

/** Agency Admin / Agency IT document library with interactive architecture maps. */
export default async function JurisdictionDocumentLibraryPage() {
  await requireRole(["agencyadmin", "agencyit", "rcsuperadmin", "rcadmin", "rcitadmin"]);
  return (
    <DocumentLibraryClient subtitle="Interactive architecture maps and curated documentation for agency administrators and IT." />
  );
}

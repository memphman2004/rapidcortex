import { DocumentLibraryClient } from "@/components/help/document-library-client";
import { requireRole } from "@/lib/auth/require-role";
import { getDocumentLibraryVertical } from "@/lib/help/document-library-verticals";

export const metadata = {
  title: "Document Library",
  robots: { index: false, follow: false },
};

/** Agency Admin / Agency IT document library — PSAP vertical only (not the RC multi-hub). */
export default async function JurisdictionDocumentLibraryPage() {
  const user = await requireRole(["agencyadmin", "agencyit", "rcsuperadmin", "rcadmin", "rcitadmin"]);
  const psap = getDocumentLibraryVertical("psap");

  return (
    <DocumentLibraryClient
      role={user.role}
      vertical={psap}
      subtitle="Interactive architecture maps and curated documentation for agency administrators and IT."
    />
  );
}

import { DocumentLibraryClient } from "@/components/help/document-library-client";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = {
  title: "Document Library",
  robots: { index: false, follow: false },
};

/** SuperAdmin / RC Admin / RC IT document library hub — all product vertical libraries. */
export default async function RcAdminDocumentLibraryPage() {
  const user = await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return (
    <DocumentLibraryClient
      role={user.role}
      title="Document Library"
      subtitle="Browse every product vertical library — Platform, PSAP, Campus, Venue, Transit, Hospital, Call Assist, and Sales."
    />
  );
}

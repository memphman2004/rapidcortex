import { DocumentLibraryClient } from "@/components/help/document-library-client";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = {
  title: "Document Library",
  robots: { index: false, follow: false },
};

/** SuperAdmin / RC Admin / RC IT document library with interactive architecture maps. */
export default async function RcAdminDocumentLibraryPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <DocumentLibraryClient />;
}

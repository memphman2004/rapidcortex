import { notFound } from "next/navigation";
import { DocumentLibraryClient } from "@/components/help/document-library-client";
import { requireRole } from "@/lib/auth/require-role";
import {
  DOCUMENT_LIBRARY_VERTICALS,
  getDocumentLibraryVertical,
  isDocumentLibraryVerticalId,
} from "@/lib/help/document-library-verticals";

export function generateStaticParams() {
  return DOCUMENT_LIBRARY_VERTICALS.map((v) => ({ vertical: v.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical: raw } = await params;
  const vertical = getDocumentLibraryVertical(raw);
  return {
    title: vertical ? `${vertical.label} Document Library` : "Document Library",
    robots: { index: false, follow: false },
  };
}

/** Per-vertical document library for RC Admin / Superadmin / IT. */
export default async function RcAdminVerticalDocumentLibraryPage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const user = await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  const { vertical: raw } = await params;
  if (!isDocumentLibraryVerticalId(raw)) notFound();
  const vertical = getDocumentLibraryVertical(raw);
  if (!vertical) notFound();

  return (
    <DocumentLibraryClient
      role={user.role}
      title={`${vertical.label} Document Library`}
      subtitle={vertical.description}
      vertical={vertical}
    />
  );
}

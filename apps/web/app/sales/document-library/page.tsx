import { DocumentLibraryClient } from "@/components/help/document-library-client";

export const metadata = {
  title: "Document Library",
  robots: { index: false, follow: false },
};

/**
 * Sales Document Library — interactive architecture maps.
 * Auth is enforced by `app/sales/layout.tsx` (`canViewPipeline`).
 */
export default function SalesDocumentLibraryPage() {
  return (
    <DocumentLibraryClient subtitle="Interactive architecture maps and curated documentation for sales enablement." />
  );
}

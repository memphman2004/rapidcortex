import { DocumentLibraryClient } from "@/components/help/document-library-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { getDocumentLibraryVertical } from "@/lib/help/document-library-verticals";
import { canViewPipeline } from "@/lib/sales/sales-authz";
import { marketingLoginPath } from "@/lib/marketing-links";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Document Library",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Sales Document Library — sales enablement only (not the multi-vertical RC hub).
 * Auth is also enforced by `app/sales/layout.tsx` (`canViewPipeline`).
 */
export default async function SalesDocumentLibraryPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canViewPipeline(user)) {
    redirect(`${marketingLoginPath()}?from=/sales/document-library`);
  }

  const salesVertical = getDocumentLibraryVertical("sales");

  return (
    <DocumentLibraryClient
      role={user.role}
      vertical={salesVertical}
      subtitle="Interactive architecture maps and curated documentation for sales enablement."
    />
  );
}

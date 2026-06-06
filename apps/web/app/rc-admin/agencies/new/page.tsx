import { requireRole } from "@/lib/auth/require-role";
import NewAgencyPage from "@/app/[jurisdiction]/(dispatch)/admin/platform/agencies/new/page";

export const metadata = {
  title: "New agency",
  robots: { index: false, follow: false },
};

export default async function RcAdminNewAgencyPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <NewAgencyPage />;
}

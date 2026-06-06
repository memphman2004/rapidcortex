import { requireRole } from "@/lib/auth/require-role";
import PlatformAgenciesPage from "@/app/[jurisdiction]/(dispatch)/admin/platform/agencies/page";

export const metadata = {
  title: "Agencies",
  robots: { index: false, follow: false },
};

/** Agency directory inside the RC Admin role dashboard shell (no redirect to dispatcher layout). */
export default async function RcAdminAgenciesPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <PlatformAgenciesPage />;
}

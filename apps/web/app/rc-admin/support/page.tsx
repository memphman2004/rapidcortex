import { requireRole } from "@/lib/auth/require-role";
import PlatformSupportPage from "@/app/[jurisdiction]/(dispatch)/admin/platform/support/page";

export const metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export default async function RcAdminSupportPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <PlatformSupportPage />;
}

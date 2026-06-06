import { requireRole } from "@/lib/auth/require-role";
import PlatformUsersPage from "@/app/[jurisdiction]/(dispatch)/admin/platform/users/page";

export const metadata = {
  title: "Platform users",
  robots: { index: false, follow: false },
};

export default async function RcAdminUsersPage() {
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <PlatformUsersPage />;
}

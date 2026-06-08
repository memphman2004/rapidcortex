import { requireRole } from "@/lib/auth/require-role";
import PlatformSystemHealthPage from "@/app/[jurisdiction]/(dispatch)/admin/platform/system-health/page";

export const metadata = {
  title: "System health",
  robots: { index: false, follow: false },
};

export default async function RcAdminSystemHealthPage() {
  await requireRole(["rcsuperadmin", "rcitadmin"]);
  return <PlatformSystemHealthPage />;
}

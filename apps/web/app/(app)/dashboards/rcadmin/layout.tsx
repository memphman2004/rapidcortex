import { redirect } from "next/navigation";
import { getAppDashboardSession } from "../../_lib/dashboard-session";

function isRcDashboardRole(role: string): boolean {
  return role === "rcadmin" || role === "rcitadmin" || role === "rcsuperadmin";
}

export default async function RcAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppDashboardSession();
  if (!isRcDashboardRole(session.role)) {
    redirect("/dashboard");
  }
  return <section className="mx-auto w-full max-w-7xl space-y-4">{children}</section>;
}


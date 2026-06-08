import type { ReactNode } from "react";
import { CampusNav } from "./_components/CampusNav";
import { CampusShellHeader } from "./_components/CampusShellHeader";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export default async function CampusShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SUPERVISOR";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <CampusShellHeader campusCode={campusCode.toUpperCase()} role={role} />
        <CampusNav campusCode={campusCode} role={role} />
        {children}
      </div>
    </div>
  );
}

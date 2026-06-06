import { AppDashboardContextProvider } from "./_components/app-dashboard-context";
import { getAppDashboardSession } from "./_lib/dashboard-session";

export default async function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppDashboardSession();
  return (
    <AppDashboardContextProvider
      value={{
        role: session.role,
        vertical: session.vertical,
        agencyId: session.agencyId,
        addons: session.addons,
        tenantLabel: session.tenantLabel,
      }}
    >
      <main className="min-h-full bg-slate-950 p-6 text-slate-100">{children}</main>
    </AppDashboardContextProvider>
  );
}


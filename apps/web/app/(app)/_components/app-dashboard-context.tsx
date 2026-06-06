"use client";

import { createContext, useContext, useMemo } from "react";
import type { TenantVertical } from "@/components/dashboards/vertical-badge";

export type AppDashboardContextValue = {
  role: string;
  vertical: TenantVertical;
  agencyId: string;
  addons: string[];
  tenantLabel: string;
};

const AppDashboardContext = createContext<AppDashboardContextValue | null>(null);

export function AppDashboardContextProvider({
  value,
  children,
}: {
  value: AppDashboardContextValue;
  children: React.ReactNode;
}) {
  const stableValue = useMemo(() => value, [value]);
  return <AppDashboardContext.Provider value={stableValue}>{children}</AppDashboardContext.Provider>;
}

export function useAppDashboardContext(): AppDashboardContextValue {
  const context = useContext(AppDashboardContext);
  if (!context) {
    throw new Error("useAppDashboardContext must be used inside AppDashboardContextProvider");
  }
  return context;
}

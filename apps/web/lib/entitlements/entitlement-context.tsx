"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  hasCAD,
  hasCore,
  hasResponder,
  hasRMS,
  hasUnifiedWorkspace,
  type DeploymentConfig,
  type NexCortiQProduct,
} from "rapid-cortex-shared";

export type EntitlementState = {
  products: NexCortiQProduct[];
  config: DeploymentConfig;
  coreEnabled: boolean;
  cadEnabled: boolean;
  rmsEnabled: boolean;
  responderEnabled: boolean;
  unifiedWorkspace: boolean;
};

const EntitlementContext = createContext<EntitlementState | null>(null);

/** Seed from the session payload. Licenses are not read from the JWT. */
export function EntitlementProvider({
  children,
  products,
  config,
}: {
  children: ReactNode;
  products: NexCortiQProduct[];
  config: DeploymentConfig;
}) {
  const entitlements = { products };
  const value: EntitlementState = {
    products,
    config,
    coreEnabled: hasCore(entitlements),
    cadEnabled: hasCAD(entitlements),
    rmsEnabled: hasRMS(entitlements),
    responderEnabled: hasResponder(entitlements),
    unifiedWorkspace: hasUnifiedWorkspace(entitlements),
  };
  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlements(): EntitlementState {
  const context = useContext(EntitlementContext);
  if (!context) {
    throw new Error("useEntitlements must be used inside EntitlementProvider");
  }
  return context;
}

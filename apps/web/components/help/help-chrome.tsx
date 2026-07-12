"use client";

import type { ReactNode } from "react";
import { HelpPanelProvider } from "./help-panel-context";
import { HelpPanel } from "./help-panel";

/** Wraps a shell so HelpButton / ContextualHelp work and the drawer can render. */
export function HelpChrome({ role, children }: { role: string; children: ReactNode }) {
  return (
    <HelpPanelProvider role={role || "dispatcher"}>
      {children}
      <HelpPanel />
    </HelpPanelProvider>
  );
}

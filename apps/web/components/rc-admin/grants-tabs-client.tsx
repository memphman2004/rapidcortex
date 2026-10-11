"use client";

import { useState } from "react";
import type { UserContext } from "rapid-cortex-shared";
import { AccessOverridesManager } from "@/components/agency-admin/access-overrides-manager";
import { GrantSuccessProgram } from "@/components/rc-admin/grant-success-program";

type Tab = "access" | "generator";

export function RcAdminGrantsTabsClient({
  initialUser,
  showGrantSuccessProgram,
  hideAccessGrants = false,
}: {
  initialUser: UserContext;
  showGrantSuccessProgram: boolean;
  /** Sales contractors see Grant Success Program only — no Access Overrides. */
  hideAccessGrants?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(hideAccessGrants ? "generator" : "access");

  const showTabBar = !hideAccessGrants && showGrantSuccessProgram;

  return (
    <div>
      {showTabBar ? (
        <div className="mb-6 flex gap-1 border-b border-slate-800">
          <TabButton active={tab === "access"} onClick={() => setTab("access")}>
            Access grants
          </TabButton>
          <TabButton active={tab === "generator"} onClick={() => setTab("generator")}>
            Grant Writer
          </TabButton>
        </div>
      ) : null}

      {!hideAccessGrants && tab === "access" ? (
        <AccessOverridesManager initialUser={initialUser} />
      ) : null}
      {(tab === "generator" || hideAccessGrants) && showGrantSuccessProgram ? (
        <GrantSuccessProgram />
      ) : null}
      {!showGrantSuccessProgram && hideAccessGrants ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Grant Writer is not enabled in this environment. Contact an RC admin if you need access.
        </p>
      ) : null}
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${
        active
          ? "border-sky-500 font-semibold text-sky-300"
          : "border-transparent font-normal text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

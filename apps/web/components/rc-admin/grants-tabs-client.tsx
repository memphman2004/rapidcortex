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

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-800">
        {!hideAccessGrants ? (
          <TabButton active={tab === "access"} onClick={() => setTab("access")}>
            Access grants
          </TabButton>
        ) : null}
        {showGrantSuccessProgram && (
          <TabButton active={tab === "generator"} onClick={() => setTab("generator")}>
            Grant Success Program
          </TabButton>
        )}
      </div>

      {!hideAccessGrants && tab === "access" ? (
        <AccessOverridesManager initialUser={initialUser} />
      ) : null}
      {tab === "generator" && showGrantSuccessProgram ? <GrantSuccessProgram /> : null}
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

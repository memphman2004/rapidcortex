"use client";

import { useState } from "react";
import type { UserContext } from "rapid-cortex-shared";
import { AccessOverridesManager } from "@/components/agency-admin/access-overrides-manager";
import { GrantSuccessProgram } from "@/components/rc-admin/grant-success-program";

type Tab = "access" | "generator";

export function RcAdminGrantsTabsClient({
  initialUser,
  showGrantSuccessProgram,
}: {
  initialUser: UserContext;
  showGrantSuccessProgram: boolean;
}) {
  const [tab, setTab] = useState<Tab>("access");

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-800">
        <TabButton active={tab === "access"} onClick={() => setTab("access")}>
          Access grants
        </TabButton>
        {showGrantSuccessProgram && (
          <TabButton active={tab === "generator"} onClick={() => setTab("generator")}>
            Grant Success Program
          </TabButton>
        )}
      </div>

      {tab === "access" && <AccessOverridesManager initialUser={initialUser} />}
      {tab === "generator" && showGrantSuccessProgram && <GrantSuccessProgram />}
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: string;
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
      {badge && (
        <span className="rounded border border-sky-700 bg-sky-950/50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-sky-300">
          {badge}
        </span>
      )}
    </button>
  );
}

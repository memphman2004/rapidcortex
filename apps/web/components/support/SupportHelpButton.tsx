"use client";

import { useState } from "react";
import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { isSupportFormUiEnabled } from "@/lib/runtime-flags";
import { SupportFormPanel } from "./SupportFormPanel";

export function SupportHelpButton({
  user,
  userRole,
  agencyId,
  agencyName,
  userId,
  userEmail,
  userName,
}: {
  user?: UserContext | null;
  userRole?: string;
  agencyId?: string;
  agencyName?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!isSupportFormUiEnabled()) return null;

  const role = userRole ?? user?.role ?? "";
  const id = userId ?? user?.userId ?? "";
  const email = userEmail ?? user?.email ?? "";
  const name = userName ?? user?.displayName ?? email;
  const agency = agencyId ?? user?.agencyId ?? "";
  const agencyLabel =
    agencyName ??
    (user && isRcInternalOperator(user.role) ? "NexCort iQ Internal" : agency) ??
    agency;

  if (!role || !id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Contact Support"
        aria-label="Open support form"
        className={[
          "flex h-7 w-7 items-center justify-center rounded-full",
          "border border-slate-700 bg-slate-900 text-slate-400",
          "text-[11px] font-bold transition",
          "hover:border-sky-500 hover:text-sky-400",
          open ? "border-sky-500 text-sky-400" : "",
        ].join(" ")}
      >
        ?
      </button>
      <SupportFormPanel
        open={open}
        onClose={() => setOpen(false)}
        userRole={role}
        agencyId={agency}
        agencyName={agencyLabel || agency || "Agency"}
        userId={id}
        userEmail={email}
        userName={name || email || "User"}
      />
    </>
  );
}

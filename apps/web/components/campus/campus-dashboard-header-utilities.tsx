"use client";

import { useState } from "react";
import { FontPicker } from "@/components/ui/font-picker";
import { UserIdentityBar } from "@/components/ui/user-identity-bar";
import { HelpButton } from "@/components/help/help-button";
import { signOutFromClient } from "@/lib/auth/sign-out-client";

function CampusSignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <button
      type="button"
      disabled={signingOut}
      onClick={() => {
        setSigningOut(true);
        void signOutFromClient();
      }}
      className="rounded border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200 disabled:opacity-50"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** Font picker + help + identity/sign-out — same controls as PSAP role dashboards. */
export function CampusDashboardHeaderUtilities({
  email,
  role,
  agencyId,
}: {
  email?: string;
  role?: string;
  agencyId?: string;
}) {
  const hasIdentity = Boolean(email?.trim() && role?.trim());

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <HelpButton />
      <FontPicker />
      {hasIdentity ? (
        <UserIdentityBar email={email!.trim()} role={role!.trim()} agencyId={agencyId} />
      ) : (
        <CampusSignOutButton />
      )}
    </div>
  );
}

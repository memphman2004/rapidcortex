"use client";

import { useState } from "react";
import { signOutFromClient } from "@/lib/auth/sign-out-client";

export function SidebarSignOutFooter({ email }: { email: string }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutFromClient();
  }

  return (
    <div className="border-t border-slate-800 p-3">
      <div className="mb-2 truncate text-[10px] text-slate-500">{email}</div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="w-full rounded border border-slate-700/60 bg-slate-800/60 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

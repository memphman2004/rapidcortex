"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardTypographyControls } from "@/components/ui/dashboard-typography-controls";
import { UserIdentityBar } from "@/components/ui/user-identity-bar";
import { HelpButton } from "@/components/help/help-button";
import { StaffGuideHeaderButton } from "@/components/staff-guide/staff-guide-button";
import { SupportHelpButton } from "@/components/support/SupportHelpButton";
import { signOutFromClient } from "@/lib/auth/sign-out-client";
import { resolveStaffGuideHref } from "@/lib/staff-guide/href";

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

/** Font picker + Staff Guide (campus/venue/transit) or 911 Help + identity/sign-out. */
export function CampusDashboardHeaderUtilities({
  email,
  role,
  agencyId,
  userId,
  leadingSlot,
}: {
  email?: string;
  role?: string;
  agencyId?: string;
  userId?: string;
  /** Rendered immediately left of Help / Font (e.g. ThemeToggle). */
  leadingSlot?: ReactNode;
}) {
  const hasIdentity = Boolean(email?.trim() && role?.trim());
  const pathname = usePathname() ?? "";
  const staffGuideHref = resolveStaffGuideHref({ role, agencyId, pathname });

  return (
    <div className="relative z-40 flex shrink-0 flex-wrap items-center justify-end gap-2 overflow-visible">
      {leadingSlot}
      {staffGuideHref ? <StaffGuideHeaderButton href={staffGuideHref} /> : <HelpButton />}
      <SupportHelpButton
        userRole={role}
        agencyId={agencyId}
        userId={userId}
        userEmail={email}
        userName={email}
      />
      <DashboardTypographyControls />
      {hasIdentity ? (
        <UserIdentityBar
          email={email!.trim()}
          role={role!.trim()}
          agencyId={agencyId}
          userId={userId}
        />
      ) : (
        <CampusSignOutButton />
      )}
    </div>
  );
}

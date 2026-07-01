import type { CSSProperties } from "react";
import type { UserRole } from "rapid-cortex-shared/types";
import { ROLE_DISPLAY_LABELS } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { verticalFromRole } from "rapid-cortex-shared";
import { roleBandColor } from "@/lib/signal-colors";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { VerticalBadge } from "@/components/ui/VerticalBadge";
import type { Vertical } from "@/lib/vertical";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { VenueGuestServicesDisclaimerGate } from "@/components/venue/venue-guest-services-disclaimer-gate";
import { isVenueGuestServicesRole } from "@/lib/venue/venue-guest-services";
import { CAMPUS_DASHBOARD_FONT_FAMILY } from "@/components/campus/campus-dashboard-font";

type Props = {
  consoleTitle: string;
  vertical: Vertical;
  role?: UserRole | string;
  description?: string;
};

export async function VerticalRoleStub({ consoleTitle, vertical, role, description }: Props) {
  const user = await getDashboardSessionUser();
  const effectiveRole = (role ?? user?.role ?? "dispatcher") as string;
  const accent = roleBandColor(effectiveRole);
  const roleLabel = ROLE_DISPLAY_LABELS[effectiveRole as UserRole] ?? effectiveRole;
  const verticalLabel = verticalFromRole(effectiveRole);
  const body =
    description ??
    "This dashboard is coming soon. The platform is live and your account is active.";
  const showGuestDisclaimer =
    vertical === "venue" && isVenueGuestServicesRole(effectiveRole);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100"
      style={
        {
          "--role-accent": accent,
          "--role-accent-dim": `color-mix(in srgb, ${accent} 22%, rgb(2 6 23))`,
          ...(vertical === "campus"
            ? { fontFamily: CAMPUS_DASHBOARD_FONT_FAMILY }
            : {}),
        } as CSSProperties
      }
    >
      <header
        className="border-b border-slate-800 px-6 py-4"
        style={{ borderTop: `4px solid ${accent}` }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <VerticalBadge vertical={vertical} size="sm" />
          <span className="text-xs uppercase tracking-wide text-slate-400">{verticalLabel}</span>
          {vertical === "campus" ? (
            <div className="ml-auto">
              <CampusDashboardHeaderUtilities
                email={user?.email}
                role={effectiveRole}
                agencyId={user?.agencyId}
              />
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        {showGuestDisclaimer ? (
          <div className="mb-6">
            <VenueGuestServicesDisclaimerGate />
          </div>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: accent }}>
          {consoleTitle}
        </h1>
        <p className="mt-2 text-sm text-slate-400">{roleLabel}</p>
        <p className="mt-8 rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 text-slate-300">
          {body}
        </p>
      </main>
    </div>
  );
}

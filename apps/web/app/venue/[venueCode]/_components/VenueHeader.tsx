import { VerticalDisclaimerBanner } from "@/components/vertical/vertical-disclaimer-banner";

const roleLabelMap: Record<string, string> = {
  VENUE_ADMIN: "VENUE ADMIN",
  VENUE_SUPERVISOR: "SUPERVISOR",
  VENUE_SECURITY: "SECURITY",
  VENUE_OPERATOR: "OPERATOR",
  VENUE_GUEST_SERVICES: "GUEST SERVICES",
};

export function VenueHeader({ venueCode, role = "VENUE_SUPERVISOR" }: { venueCode: string; role?: string }) {
  const roleLabel = roleLabelMap[role] ?? role;

  return (
    <header className="rounded-lg border border-orange-500/30 bg-slate-900/50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-orange-300/80">Rapid Cortex Venue</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-white">{venueCode}</h1>
            <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-100">
              {roleLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {role === "VENUE_GUEST_SERVICES"
              ? "Guest services inbox"
              : role === "VENUE_OPERATOR"
                ? "Venue operator console"
                : "Game day operations console"}
          </p>
        </div>
      </div>
      {role === "VENUE_GUEST_SERVICES" ? (
        <div className="mt-3">
          <VerticalDisclaimerBanner message="NOT A 911 EMERGENCY DISPATCH SYSTEM" />
        </div>
      ) : null}
    </header>
  );
}

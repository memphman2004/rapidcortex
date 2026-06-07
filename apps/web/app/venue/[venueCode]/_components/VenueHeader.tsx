const roleLabelMap: Record<string, string> = {
  VENUE_ADMIN: "Admin",
  VENUE_SUPERVISOR: "Supervisor",
  VENUE_SECURITY: "Security",
  VENUE_OPERATOR: "Operator",
  VENUE_GUEST_SERVICES: "Guest Services",
};

export function VenueHeader({ venueCode, role = "VENUE_SUPERVISOR" }: { venueCode: string; role?: string }) {
  const roleLabel = roleLabelMap[role] ?? role;

  return (
    <header className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Rapid Cortex Venue</p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{venueCode}</h1>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-200">
              {roleLabel}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          {role === "VENUE_GUEST_SERVICES"
            ? "Guest services console"
            : role === "VENUE_OPERATOR"
              ? "Venue operator console"
              : "Game day operations console"}
        </p>
      </div>
    </header>
  );
}

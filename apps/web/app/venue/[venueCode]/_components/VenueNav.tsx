import Link from "next/link";

const restrictedForSecurityAndBelow = new Set([
  "VENUE_SECURITY",
  "VENUE_OPERATOR",
  "VENUE_GUEST_SERVICES",
]);

const restrictedForGuestServices = new Set(["VENUE_GUEST_SERVICES"]);

const navItems = [
  { key: "dashboard", label: "Dashboard", path: "" },
  { key: "incidents", label: "Incidents", path: "incidents" },
  { key: "reports", label: "Guest Reports", path: "reports" },
  { key: "qr", label: "QR Codes", path: "qr-codes" },
  { key: "cameras", label: "Cameras", path: "cameras" },
  { key: "zones", label: "Zones", path: "zones" },
  { key: "analytics", label: "Analytics", path: "analytics" },
  { key: "settings", label: "Settings", path: "settings" },
] as const;

function canViewNavItem(key: string, role: string): boolean {
  if ((key === "analytics" || key === "settings") && restrictedForSecurityAndBelow.has(role)) return false;
  if ((key === "cameras" || key === "zones") && restrictedForGuestServices.has(role)) return false;
  return true;
}

export function VenueNav({ venueCode, role = "VENUE_SUPERVISOR" }: { venueCode: string; role?: string }) {
  return (
    <nav className="w-full rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 lg:w-64 lg:shrink-0">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {navItems
          .filter((item) => canViewNavItem(item.key, role))
          .map((item) => (
            <li key={item.key}>
              <Link
                href={item.path.length > 0 ? `/app/venue/${venueCode}/${item.path}` : `/app/venue/${venueCode}`}
                className="block rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800"
              >
                {item.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}

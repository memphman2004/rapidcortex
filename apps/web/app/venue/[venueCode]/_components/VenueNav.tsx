import Link from "next/link";
import { canViewVenueNavItem } from "@/lib/venue/venue-nav-access";

const navItems = [
  { key: "dashboard" as const, label: "Dashboard", path: "" },
  { key: "incidents" as const, label: "Incidents", path: "incidents" },
  { key: "reports" as const, label: "Guest Reports", path: "reports" },
  { key: "qr" as const, label: "QR Codes", path: "qr-codes" },
  { key: "cameras" as const, label: "Cameras", path: "cameras" },
  { key: "zones" as const, label: "Zones", path: "zones" },
  { key: "analytics" as const, label: "Analytics", path: "analytics" },
  { key: "settings" as const, label: "Settings", path: "settings" },
];

export function VenueNav({ venueCode, role = "VENUE_SUPERVISOR" }: { venueCode: string; role?: string }) {
  return (
    <nav className="w-full rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 lg:w-64 lg:shrink-0">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {navItems
          .filter((item) => canViewVenueNavItem(item.key, role))
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

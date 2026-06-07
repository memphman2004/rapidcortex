"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { campusNavKeysForRole } from "@/lib/venue/venue-nav-access";

const navItems = [
  { key: "dashboard", label: "Safety dashboard", path: "" },
  { key: "incidents", label: "Incidents", path: "incidents" },
  { key: "reports", label: "Reports", path: "reports" },
  { key: "zones", label: "Zones", path: "zones" },
  { key: "qr-codes", label: "QR Codes", path: "qr-codes" },
] as const;

export function CampusNav({
  campusCode,
  role = "CAMPUS_SUPERVISOR",
}: {
  campusCode: string;
  role?: string;
}) {
  const pathname = usePathname();
  const allowed = new Set(campusNavKeysForRole(role));
  const base = `/app/campus/${campusCode}`;

  return (
    <nav className="mb-5 w-full rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-3">
      <ul className="flex flex-wrap gap-2">
        {navItems
          .filter((item) => allowed.has(item.key))
          .map((item) => {
            const href = item.path.length > 0 ? `${base}/${item.path}` : base;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={item.key}>
                <Link
                  href={href}
                  className={`block rounded-md px-3 py-2 text-sm font-semibold ${
                    active
                      ? "bg-emerald-900/40 text-emerald-100"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}

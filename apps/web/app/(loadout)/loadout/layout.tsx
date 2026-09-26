import "server-only";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isLoadoutPortalEnabled } from "@/lib/runtime-flags";

const NAV_LINKS = [
  { href: "/loadout/dashboard", label: "Dashboard" },
  { href: "/loadout/catalog", label: "Catalog" },
  { href: "/loadout/invoices", label: "Invoices" },
  { href: "/loadout/keys", label: "API Keys" },
];

function canAccessLoadout(role: string): boolean {
  return role === "rcsuperadmin" || role === "rcadmin" || role === "agencyadmin";
}

export default async function LoadoutLayout({ children }: { children: React.ReactNode }) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessLoadout(user.role ?? "") || !isLoadoutPortalEnabled()) {
    redirect(`${marketingLoginPath()}?from=/loadout/dashboard`);
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0f1117]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-violet-400 font-mono text-xs tracking-widest uppercase font-semibold">
              NexCortiQ
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 text-sm font-medium">Loadout Portal</span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="text-xs text-slate-500">
            {user.email ?? user.agencyId ?? ""}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}

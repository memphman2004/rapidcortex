import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import {
  VENUE_CAMPUS_APPS_LABEL,
  VENUE_CAMPUS_STORE_LINKS,
} from "@/lib/mobile-store-links";

export const metadata = {
  title: VENUE_CAMPUS_APPS_LABEL,
  robots: { index: false, follow: false },
};

/** Canonical Google Play + App Store links for Venue & Campus field apps. */
export default async function RcAdminVenueCampusAppsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !isRcInternalOperator(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/venue-campus-apps`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">{VENUE_CAMPUS_APPS_LABEL}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Store listings for the Venue and Campus QR / NFC field apps. Share these links
          during onboarding — iOS is unlisted, so staff need the direct App Store URL.
        </p>
      </div>

      <ul className="space-y-3">
        {VENUE_CAMPUS_STORE_LINKS.map((link) => (
          <li
            key={link.id}
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-violet-300">
              {link.platform}
            </p>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-2 text-base font-semibold text-sky-300 hover:text-sky-200"
            >
              {link.label}
              <ExternalLink className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            </a>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{link.href}</p>
            <p className="mt-2 text-xs text-slate-400">{link.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

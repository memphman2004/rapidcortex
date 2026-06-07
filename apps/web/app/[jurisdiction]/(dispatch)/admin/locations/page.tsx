"use client";

import Link from "next/link";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

export default function AdminLocationsPage() {
  const to = useJurisdictionLink();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
      <h1 className="text-xl font-semibold text-white">Locations &amp; QR Codes</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        QR scan points are managed in <strong className="text-slate-200">Campus</strong> and{" "}
        <strong className="text-slate-200">Venue</strong> admin workspaces — not PSAP agency admin.
        Campus and venue admins with <code className="text-slate-300">locations.qrcodes.manage</code> can
        create locations; supervisors and security staff with view access can list and download assets.
      </p>
      <Link href={to("/admin")} className="mt-6 inline-block text-sm font-medium text-sky-400 hover:text-sky-300">
        ← Back to administration
      </Link>
    </div>
  );
}

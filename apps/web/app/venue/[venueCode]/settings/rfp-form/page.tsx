"use client";

import Link from "next/link";
import { use } from "react";
import { useSession } from "@/components/auth/session-context";
import { VenueFormSettingsAdmin } from "@/components/venue/rfp/venue-form-settings-admin";
import { canVenueSupervisorOps } from "@/lib/vertical/supervisor-access";

export default function VenueRfpFormSettingsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  const normalized = venueCode.toUpperCase().replace(/-/g, "");
  const { user } = useSession();
  const canMutate = canVenueSupervisorOps(user?.role);

  return (
    <div className="space-y-4 p-4">
      <Link
        href={`/venue/${normalized}/settings`}
        className="text-xs"
        style={{ color: "var(--rc-text-secondary)" }}
      >
        ← Settings
      </Link>
      <VenueFormSettingsAdmin venueCode={normalized} canMutate={canMutate} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { VenueOperationsShell } from "@/components/venue/venue-operations-shell";
import { canVenueAgencyIt } from "@/lib/venue/venue-access";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function VenueSettingsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const { user, venueName, linkBase, agencyId } = await loadVenueJurisdictionContext(jurisdiction);

  if (!canVenueAgencyIt(user.role)) {
    redirect(linkBase);
  }

  return (
    <VenueOperationsShell
      agencyId={agencyId}
      venueName={venueName}
      linkBase={linkBase}
      userEmail={user.email ?? ""}
      userRole={user.role}
    >
      <div style={{ padding: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Venue Settings</h2>
        <p style={{ fontSize: 12, color: "#5a4d7a" }}>
          Agency IT configuration for {venueName}. Manage integrations, sections, and notification policies here.
        </p>
        <Link
          href={`${linkBase}/settings/cameras`}
          style={{ fontSize: 12, color: "#f59e0b", textDecoration: "none", display: "inline-block", marginTop: 8 }}
        >
          Camera registry →
        </Link>
      </div>
    </VenueOperationsShell>
  );
}

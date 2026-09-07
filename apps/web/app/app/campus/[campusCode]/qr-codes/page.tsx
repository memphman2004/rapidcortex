import Link from "next/link";
import { redirect } from "next/navigation";
import { QrLocationsWorkspace } from "@/components/locations/qr-locations-workspace";
import { QRNFCManager } from "@/components/qr-nfc/qr-nfc-manager";
import { loadCampusConsolePageContext } from "@/lib/campus/campus-admin-page";
import { qrCodePermissions } from "@/lib/qr-nfc/access";

type Props = {
  params: Promise<{ campusCode: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function CampusQrCodesPage({ params, searchParams }: Props) {
  const { campusCode: raw } = await params;
  const { view } = await searchParams;
  const { campusCode, user, agencyId } = await loadCampusConsolePageContext(raw);

  if (!agencyId) {
    return (
      <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-5">
        <h2 className="text-lg font-semibold text-amber-100">Campus tenant not found</h2>
        <p className="mt-2 text-sm text-amber-200/80">
          No agency matches campus code <span className="font-mono">{campusCode}</span>.
        </p>
      </section>
    );
  }

  if (view === "locations") {
    return (
      <div className="space-y-4">
        <Link
          href={`/app/campus/${campusCode}/qr-codes`}
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          ← Report QR &amp; NFC codes
        </Link>
        <QrLocationsWorkspace
          vertical="campus"
          orgCode={campusCode}
          title="Location QR (RCLI)"
          description="Building and zone scan points with RCLI identifiers. These are separate from the named report codes in the Field app."
        />
      </div>
    );
  }

  const perms = qrCodePermissions(user, agencyId);
  if (!perms.canView) redirect("/unauthorized");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--rc-text-primary)" }}>
          Campus QR Codes
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--rc-text-muted)" }}>
          Named report codes for buildings and zones. Same list as the Rapid Cortex Field app.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link
            href={`/app/campus/${campusCode}/sms-numbers`}
            className="text-sky-400 hover:text-sky-300"
          >
            SMS numbers →
          </Link>
          <Link
            href={`/app/campus/${campusCode}/qr-codes?view=locations`}
            className="text-sky-400 hover:text-sky-300"
          >
            Location QR (RCLI) →
          </Link>
        </div>
      </div>
      <QRNFCManager
        agencyId={agencyId}
        vertical="campus"
        canCreate={perms.canCreate}
        canDeactivate={perms.canDeactivate}
        canDownload={perms.canDownload}
        zoneLabel="Building / Floor / Room"
        hideHeading
        tenantConsole
      />
    </div>
  );
}

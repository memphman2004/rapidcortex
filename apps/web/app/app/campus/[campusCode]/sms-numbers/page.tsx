import Link from "next/link";
import { redirect } from "next/navigation";
import { SmsRoutingManager } from "@/components/sms-routing/sms-routing-manager";
import { loadCampusConsolePageContext } from "@/lib/campus/campus-admin-page";
import { smsRoutingPermissions } from "@/lib/sms-routing/access";

type Props = { params: Promise<{ campusCode: string }> };

export default async function CampusSmsNumbersPage({ params }: Props) {
  const { campusCode: raw } = await params;
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

  const perms = smsRoutingPermissions(user, agencyId);
  if (!perms.canView) redirect("/unauthorized");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--rc-text-primary)" }}>
          SMS Numbers
        </h1>
        <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--rc-text-muted)" }}>
          Register the Twilio number printed on campus signs. Incoming texts are routed by the
          destination number — no keywords or prefixes required.
        </p>
        <div className="mt-3">
          <Link
            href={`/app/campus/${campusCode}/qr-codes`}
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← QR codes
          </Link>
        </div>
      </div>
      <SmsRoutingManager
        agencyId={agencyId}
        agencyName={agencyId}
        defaultVertical="campus"
        canManage={perms.canManage}
      />
    </div>
  );
}

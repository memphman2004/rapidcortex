import Link from "next/link";
import { redirect } from "next/navigation";
import { SmsRoutingManager } from "@/components/sms-routing/sms-routing-manager";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { smsRoutingPermissions } from "@/lib/sms-routing/access";

export const metadata = {
  title: "SMS Numbers (Campus Admin)",
  robots: { index: false, follow: false },
};

export default async function CampusAdminSmsNumbersPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");

  const perms = smsRoutingPermissions(user, user.agencyId);
  if (!perms.canView) redirect("/unauthorized");

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">SMS Numbers</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Register the Twilio number printed on campus signs. Incoming texts are routed by the
          destination number — no keywords or prefixes required.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/app/campus/admin/qr-codes" className="text-sky-400 hover:text-sky-300">
            ← QR codes
          </Link>
        </div>
      </div>
      <SmsRoutingManager
        agencyId={user.agencyId}
        agencyName={user.agencyId}
        defaultVertical="campus"
        canManage={perms.canManage}
      />
    </div>
  );
}

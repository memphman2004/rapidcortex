import { redirect } from "next/navigation";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { TicketBoardClient } from "@/components/rc-admin/support/ticket-board-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSupportFormUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Support Tickets",
  robots: { index: false, follow: false },
};

export default async function RcAdminSupportTicketsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !isRcInternalOperator(user.role) || !isSupportFormUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/support-tickets`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Support Tickets</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Operational board for web-form support tickets. Drag cards between statuses, add notes, and
          track SEV1 / SEV2 load. Phone-line records remain on the call audit log.
        </p>
      </div>
      <TicketBoardClient />
    </div>
  );
}

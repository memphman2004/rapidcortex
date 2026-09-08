import { requireRole } from "@/lib/auth/require-role";
import { CallAssistBotFleetClient } from "@/components/rc-admin/call-assist-bot-fleet-client";
import { isCallAssistEnabled } from "@/lib/runtime-flags";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Call Assist bots",
  robots: { index: false, follow: false },
};

export default async function RcAdminCallAssistBotsPage() {
  if (!isCallAssistEnabled()) notFound();
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <CallAssistBotFleetClient />;
}

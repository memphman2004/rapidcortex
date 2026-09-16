import { requireRole } from "@/lib/auth/require-role";
import { RcAdminCallAssistClient } from "@/components/rc-admin/rc-admin-call-assist-client";
import { isCallAssistEnabled } from "@/lib/runtime-flags";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Call Assist",
  robots: { index: false, follow: false },
};

export default async function RcAdminCallAssistPage() {
  if (!isCallAssistEnabled()) notFound();
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  return <RcAdminCallAssistClient />;
}

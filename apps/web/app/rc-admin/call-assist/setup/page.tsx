import { requireRole } from "@/lib/auth/require-role";
import { CallAssistSetupWizard } from "@/components/call-assist/setup/call-assist-setup-wizard";
import { CallAssistWorkspace } from "@/components/call-assist/call-assist-workspace";
import { CallAssistProductBaseProvider } from "@/lib/jurisdiction-context";
import { isCallAssistEnabled } from "@/lib/runtime-flags";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Call Assist setup",
  robots: { index: false, follow: false },
};

export default async function RcAdminCallAssistSetupPage() {
  if (!isCallAssistEnabled()) notFound();
  await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);

  return (
    <CallAssistProductBaseProvider base="/rc-admin/call-assist">
      <div className="flex h-[calc(100vh-9rem)] min-h-[28rem]">
        <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading Call Assist setup…</p>}>
          <CallAssistWorkspace>
            <CallAssistSetupWizard />
          </CallAssistWorkspace>
        </Suspense>
      </div>
    </CallAssistProductBaseProvider>
  );
}

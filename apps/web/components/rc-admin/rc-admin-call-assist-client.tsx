"use client";

import { Suspense } from "react";
import { CallAssistAdminEditor } from "@/components/call-assist/admin/call-assist-admin-editor";
import { CallAssistWorkspace } from "@/components/call-assist/call-assist-workspace";
import { useAgencyContext } from "@/contexts/agency-context";
import { JurisdictionProvider } from "@/lib/jurisdiction-context";

/**
 * RC operator Call Assist: agency switcher + greeting/config editor.
 * Nested jurisdiction slug follows the selected tenant so chrome links stay on that agency.
 */
export function RcAdminCallAssistClient() {
  const { activeAgencyId } = useAgencyContext();
  const slug = activeAgencyId ?? "kcpd";

  return (
    <JurisdictionProvider slug={slug}>
      <div className="flex h-[calc(100vh-9rem)] min-h-[28rem]">
        <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading Call Assist…</p>}>
          <CallAssistWorkspace>
            <CallAssistAdminEditor />
          </CallAssistWorkspace>
        </Suspense>
      </div>
    </JurisdictionProvider>
  );
}

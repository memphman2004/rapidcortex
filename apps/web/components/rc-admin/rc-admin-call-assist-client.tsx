"use client";

import { Suspense } from "react";
import { CallAssistAdminEditor } from "@/components/call-assist/admin/call-assist-admin-editor";
import { CallAssistWorkspace } from "@/components/call-assist/call-assist-workspace";
import { CallAssistProductBaseProvider } from "@/lib/jurisdiction-context";

/**
 * RC operator Nexiq: agency switcher + greeting/config editor.
 *
 * Use the Nexiq product base (`/app/call-assist/...`) for setup/config links —
 * wrapping with JurisdictionProvider(agencyId) previously sent operators to
 * `/{agencyId}/call-assist/setup`, which 404s when agencyId is not a jurisdiction slug.
 */
export function RcAdminCallAssistClient() {
  return (
    <CallAssistProductBaseProvider base="/rc-admin/call-assist">
      <div className="flex h-[calc(100vh-9rem)] min-h-[28rem]">
        <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading Nexiq…</p>}>
          <CallAssistWorkspace>
            <CallAssistAdminEditor />
          </CallAssistWorkspace>
        </Suspense>
      </div>
    </CallAssistProductBaseProvider>
  );
}

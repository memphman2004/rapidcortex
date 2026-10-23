"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CardEditor } from "./card-editor";
import { AdminDirectory, AdminEditor, AnalyticsPanel, AuditList, CardSettings, CreateWizard, NfcAdmin } from "./admin-panels";

function viewFromPath(pathname: string): "editor" | "directory" | "wizard" | "settings" | "audit" | "nfc" | "analytics" | "admin-edit" {
  if (pathname.includes("/profile/business-card") || pathname.includes("/sales/business-card")) return "editor";
  if (pathname.includes("/nfc-cards")) return "nfc";
  if (pathname.includes("/analytics/business-cards")) return "analytics";
  if (pathname.endsWith("/new")) return "wizard";
  if (pathname.endsWith("/settings")) return "settings";
  if (pathname.endsWith("/audit")) return "audit";
  const match = pathname.match(/\/admin\/business-cards\/([^/]+)/);
  if (match && !["new", "settings", "audit"].includes(match[1])) return "admin-edit";
  return "directory";
}

export function BusinessCardScreen() {
  const pathname = usePathname() ?? "";
  const view = viewFromPath(pathname);
  const profileId = pathname.match(/\/admin\/business-cards\/([^/]+)/)?.[1];
  const isContactEditor = view === "editor" || view === "admin-edit";
  return (
    <div className={isContactEditor ? "max-w-[1400px]" : "mx-auto max-w-6xl text-slate-100"}>
      {isContactEditor ? null : (
        <>
          <h1 className="text-xl font-semibold">My Contact Card</h1>
          <p className="mt-1 text-sm text-slate-400">NexCort iQ employees can update the contact information on their card. Company name stays locked.</p>
        </>
      )}
      <div className={isContactEditor ? "" : "mt-6"}>
        {view === "editor" ? <CardEditor mode="self" /> : null}
        {view === "directory" ? <Suspense fallback={null}><AdminDirectory /></Suspense> : null}
        {view === "wizard" ? <CreateWizard /> : null}
        {view === "settings" ? <CardSettings /> : null}
        {view === "audit" ? <AuditList /> : null}
        {view === "nfc" ? <NfcAdmin /> : null}
        {view === "analytics" ? <AnalyticsPanel /> : null}
        {view === "admin-edit" && profileId ? <AdminEditor profileId={profileId} /> : null}
      </div>
    </div>
  );
}

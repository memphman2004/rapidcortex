"use client";

import { Suspense } from "react";
import { CallAssistWorkspace } from "@/components/call-assist/call-assist-workspace";

export default function CallAssistLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading Call Assist…</p>}>
      <CallAssistWorkspace>{children}</CallAssistWorkspace>
    </Suspense>
  );
}

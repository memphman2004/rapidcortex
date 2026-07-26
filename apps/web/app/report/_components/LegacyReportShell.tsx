import type { ReactNode } from "react";
import { ReportHeader } from "./ReportHeader";

/** Chrome for the legacy venue multi-step ReportWizard (non ULID /rcli paths). */
export function LegacyReportShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <ReportHeader />
        <div className="flex-1 pt-2">{children}</div>
        <footer className="sticky bottom-0 mt-3 border-t border-slate-200 bg-white/95 py-3 text-center text-xs text-slate-500 backdrop-blur">
          For life-threatening emergencies, call 911.
        </footer>
      </main>
    </div>
  );
}

"use client";

import { CadWritebackApprovalQueue } from "@/components/cad/cad-writeback-approval-queue";
import { useSession } from "@/components/auth/session-context";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";
import { SupervisorWorkspace } from "@/components/dispatch/supervisor-workspace";

export default function ReviewPage() {
  const { user } = useSession();
  const writebackUi = isCadWritebackUiEnabled();

  if (!writebackUi) {
    return <SupervisorWorkspace />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 pb-10">
      <header>
        <h1 className="text-xl font-semibold text-white">CAD write-back queue</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Review dispatcher narratives before they are sent to your agency CAD system. Every approve
          and reject action is audit logged.
        </p>
      </header>
      <section className="rounded-xl border border-slate-800 bg-[#09080f] p-4">
        <CadWritebackApprovalQueue currentUserId={user?.userId} />
      </section>
    </div>
  );
}

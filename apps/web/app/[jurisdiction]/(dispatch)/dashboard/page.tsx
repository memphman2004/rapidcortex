import { Suspense } from "react";
import { DashboardWorkspace } from "@/components/dispatch/dashboard-workspace";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-slate-500">
          Loading dashboard…
        </div>
      }
    >
      <DashboardWorkspace />
    </Suspense>
  );
}

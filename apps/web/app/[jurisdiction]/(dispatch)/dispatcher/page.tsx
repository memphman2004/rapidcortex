import { Suspense } from "react";
import { DashboardWorkspace } from "@/components/dispatch/dashboard-workspace";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Props = { params: Promise<{ jurisdiction: string }> };

/** Live dispatcher call-taking workspace (CAD). Ops overview is at /dashboard. */
export default async function DispatcherRootPage({ params }: Props) {
  const { jurisdiction } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);

  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-slate-500">
          Loading dispatcher…
        </div>
      }
    >
      <DashboardWorkspace />
    </Suspense>
  );
}

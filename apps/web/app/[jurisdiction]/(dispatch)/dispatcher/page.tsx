import { Suspense } from "react";
import { DashboardWorkspace } from "@/components/dispatch/dashboard-workspace";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Props = { params: Promise<{ jurisdiction: string }> };

/** Live dispatcher workspace — same surface as /dashboard so Operations → Dispatcher is a real destination. */
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

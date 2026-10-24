import { Suspense } from "react";
import { DashboardWorkspace } from "@/components/dispatch/dashboard-workspace";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Props = { params: Promise<{ jurisdiction: string }> };

/** One dispatcher section in its own window. The three-column console stays as it was. */
export default async function DispatcherSectionPopoutPage({ params }: Props) {
  const { jurisdiction } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center text-sm text-slate-500">
          Opening section…
        </div>
      }
    >
      <DashboardWorkspace popout />
    </Suspense>
  );
}

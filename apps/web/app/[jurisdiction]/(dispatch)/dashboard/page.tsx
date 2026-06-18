import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardWorkspace } from "@/components/dispatch/dashboard-workspace";
import { resolveAgencyVerticalForJurisdiction } from "@/lib/venue/venue-psap-route-guard";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function DashboardPage({ params }: Props) {
  const { jurisdiction } = await params;
  const vertical = await resolveAgencyVerticalForJurisdiction(jurisdiction);
  if (vertical === "venue" || vertical === "campus") {
    redirect(`/${encodeURIComponent(jurisdiction)}`);
  }

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

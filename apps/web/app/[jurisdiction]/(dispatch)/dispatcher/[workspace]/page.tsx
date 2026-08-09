import { notFound, redirect } from "next/navigation";
import { NonEmergencyWorkspace } from "@/components/triage/non-emergency-workspace";
import { dispatchDashboardHref } from "@/lib/dispatch-workspace-links";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Ctx = { params: Promise<{ workspace: string; jurisdiction: string }> };

/** Legacy `/dispatcher/{workspace}` shells → live CAD workspace (or dedicated triage UI). */
export default async function DispatcherWorkspacePage({ params }: Ctx) {
  const { workspace, jurisdiction } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);

  if (workspace === "triage") {
    return <NonEmergencyWorkspace variant="triage" />;
  }
  if (workspace === "non-emergency") {
    return <NonEmergencyWorkspace variant="non-emergency" />;
  }

  if (workspace === "intake" || workspace === "transcription" || workspace === "incidents") {
    redirect(dispatchDashboardHref(jurisdiction));
  }

  if (workspace === "media") {
    redirect(`/${encodeURIComponent(jurisdiction)}/media`);
  }

  notFound();
}

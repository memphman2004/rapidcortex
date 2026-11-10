import { ResponderIncidentDashboard } from "@/components/responder/responder-incident-dashboard";
import { isIqResponderEnabled } from "@/lib/runtime-flags";
import { redirect } from "next/navigation";

export default async function ResponderIncidentPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  if (!isIqResponderEnabled()) {
    redirect("/not-authorized");
  }
  const resolved = await params;
  return <ResponderIncidentDashboard incidentId={resolved.incidentId} />;
}

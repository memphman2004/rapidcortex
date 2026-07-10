import { notFound } from "next/navigation";
import { FeatureRoutePlaceholder } from "@/components/rapid-cortex/feature-route-placeholder";
import { NonEmergencyWorkspace } from "@/components/triage/non-emergency-workspace";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

const PLACEHOLDER_WORKSPACES: Record<string, { title: string; featureId: string; summary: string }> = {
  intake: {
    title: "Dispatcher Intake",
    featureId: "ai_assisted_intake",
    summary: "Create and manage active intake sessions with AI-assisted guidance.",
  },
  transcription: {
    title: "Dispatcher Transcription",
    featureId: "live_transcription",
    summary: "Start/stop transcription and review transcript stream in dispatcher workflow.",
  },
  incidents: {
    title: "Dispatcher Incidents",
    featureId: "active_incident_view",
    summary: "Track active incidents and open incident details.",
  },
  media: {
    title: "Dispatcher Media",
    featureId: "caller_video_upload",
    summary: "Review caller media workflows and evidentiary context.",
  },
};

type Ctx = { params: Promise<{ workspace: string; jurisdiction: string }> };

export default async function DispatcherWorkspacePage({ params }: Ctx) {
  const { workspace, jurisdiction } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);

  if (workspace === "triage") {
    return <NonEmergencyWorkspace variant="triage" />;
  }
  if (workspace === "non-emergency") {
    return <NonEmergencyWorkspace variant="non-emergency" />;
  }

  const config = PLACEHOLDER_WORKSPACES[workspace];
  if (!config) {
    notFound();
  }

  return (
    <FeatureRoutePlaceholder
      title={config.title}
      featureId={config.featureId}
      summary={config.summary}
    />
  );
}

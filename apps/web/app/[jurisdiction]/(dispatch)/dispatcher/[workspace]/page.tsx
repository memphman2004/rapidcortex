import { notFound } from "next/navigation";
import { FeatureRoutePlaceholder } from "@/components/rapid-cortex/feature-route-placeholder";

const WORKSPACES: Record<string, { title: string; featureId: string; summary: string }> = {
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
  triage: {
    title: "Dispatcher Triage",
    featureId: "call_triage_workflows",
    summary: "Review AI triage suggestions and apply dispatcher-reviewed decisions.",
  },
  incidents: {
    title: "Dispatcher Incidents",
    featureId: "active_incident_view",
    summary: "Track active incidents and open incident details.",
  },
  "non-emergency": {
    title: "Non-Emergency Queue",
    featureId: "non_emergency_intake_queue",
    summary: "Manage non-emergency intake and backlog handoffs.",
  },
  media: {
    title: "Dispatcher Media",
    featureId: "caller_video_upload",
    summary: "Review caller media workflows and evidentiary context.",
  },
};

type Ctx = { params: Promise<{ workspace: string }> };

export default async function DispatcherWorkspacePage({ params }: Ctx) {
  const { workspace } = await params;
  const config = WORKSPACES[workspace];
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

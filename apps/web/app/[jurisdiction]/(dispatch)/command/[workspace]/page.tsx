import { notFound } from "next/navigation";
import { FeatureRoutePlaceholder } from "@/components/rapid-cortex/feature-route-placeholder";
import {
  ViewAvailableRingCamerasButton,
  isRingAvailableCamerasEnabled,
} from "@/src/features/connect/ring";

const WORKSPACES: Record<string, { title: string; featureId: string; summary: string }> = {
  dashboard: {
    title: "Command Dashboard",
    featureId: "command_dashboard",
    summary: "Unified command dashboard for major incidents and escalations.",
  },
  "war-room": {
    title: "War Room",
    featureId: "war_rooms",
    summary: "Cross-role war room coordination for command operations.",
  },
  runbooks: {
    title: "Runbooks and Playbooks",
    featureId: "runbooks_playbooks",
    summary: "Operational runbooks and playbooks for incident command workflows.",
  },
  timeline: {
    title: "Incident Timeline",
    featureId: "incident_timeline_reconstruction",
    summary: "Timeline reconstruction and event sequencing.",
  },
  "post-incident-review": {
    title: "Post-Incident Review",
    featureId: "post_incident_reviews",
    summary: "Post-incident review and after-action workflow.",
  },
};

type Ctx = { params: Promise<{ workspace: string }> };

export default async function CommandWorkspacePage({ params }: Ctx) {
  const { workspace } = await params;
  const config = WORKSPACES[workspace];
  if (!config) {
    notFound();
  }

  return (
    <div className="space-y-3">
      {isRingAvailableCamerasEnabled() && (
        <ViewAvailableRingCamerasButton
          incidentId={null}
          incidentLatitude={null}
          incidentLongitude={null}
          userRole="dispatcher"
        />
      )}
      <FeatureRoutePlaceholder
        title={config.title}
        featureId={config.featureId}
        summary={config.summary}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { FeatureRoutePlaceholder } from "@/components/rapid-cortex/feature-route-placeholder";

const WORKSPACES: Record<string, { title: string; featureId: string; summary: string }> = {
  monitoring: {
    title: "Reliability Monitoring",
    featureId: "monitoring_integrations",
    summary: "Monitoring integrations and signal health views.",
  },
  alerts: {
    title: "Alert Correlation",
    featureId: "alert_correlation",
    summary: "Correlate operational alerts and incident signals.",
  },
  escalation: {
    title: "Escalation Engine",
    featureId: "escalation_engine",
    summary: "Escalation workflows and response routing.",
  },
  "on-call": {
    title: "On-call Routing",
    featureId: "on_call_routing",
    summary: "On-call handoff and routing controls.",
  },
  slo: {
    title: "SLO Dashboards",
    featureId: "slo_dashboards",
    summary: "Service level objective dashboards and trends.",
  },
};

type Ctx = { params: Promise<{ workspace: string }> };

export default async function ReliabilityWorkspacePage({ params }: Ctx) {
  const { workspace } = await params;
  const config = WORKSPACES[workspace];
  if (!config) notFound();

  return (
    <FeatureRoutePlaceholder
      title={config.title}
      featureId={config.featureId}
      summary={config.summary}
    />
  );
}

import { RoleDashboardSmokePanel } from "@/components/dispatch/role-dashboard-smoke-panel";
import { FeatureRoutePlaceholder } from "@/components/rapid-cortex/feature-route-placeholder";

export default function DispatcherRootPage() {
  return (
    <div>
      {process.env.NODE_ENV === "development" ? (
        <div className="px-4 pt-4">
          <RoleDashboardSmokePanel
            title="Dispatcher"
            pathLabel="/[jurisdiction]/dispatcher"
          />
        </div>
      ) : null}
      <FeatureRoutePlaceholder
        title="Dispatcher Console"
        featureId="dispatcher_console"
        summary="Primary dispatcher workspace with intake, triage, transcription, and incident context."
      />
    </div>
  );
}

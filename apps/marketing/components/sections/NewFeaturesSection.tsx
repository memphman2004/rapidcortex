import { FeatureCadInterop } from "./FeatureCadInterop";
import { FeatureNonEmergency } from "./FeatureNonEmergency";

export { FeatureCadInterop } from "./FeatureCadInterop";
export { FeatureNonEmergency } from "./FeatureNonEmergency";

function SectionDivider() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 1,
        background: "linear-gradient(90deg, transparent 0%, #1A2940 20%, #1A2940 80%, transparent 100%)",
      }}
    />
  );
}

/**
 * CAD-to-CAD and 311 AI sections with a divider between them.
 * Place after the homepage hero and before the existing feature grid.
 */
export function NewFeaturesSection() {
  return (
    <div id="new-features" className="scroll-mt-28">
      <FeatureCadInterop />
      <SectionDivider />
      <FeatureNonEmergency />
    </div>
  );
}

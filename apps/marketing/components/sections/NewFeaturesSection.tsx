import { FeatureCadInterop } from "./FeatureCadInterop";
import { FeatureCampusSafety } from "./FeatureCampusSafety";
import { FeatureNonEmergency } from "./FeatureNonEmergency";

export { FeatureCadInterop } from "./FeatureCadInterop";
export { FeatureNonEmergency } from "./FeatureNonEmergency";
export { FeatureCampusSafety } from "./FeatureCampusSafety";

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
 * Product demonstrations — CAD bridge, NEXiQ workflow, and Campus Safety.
 * Equal visual weight; place after product solution cards.
 */
export function NewFeaturesSection() {
  return (
    <div id="new-features" className="scroll-mt-28">
      <div className="bg-[#060910] px-4 pb-4 pt-20 sm:px-6 md:pt-24">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="rc-title-gradient text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-[2.75rem]">
            See it in action
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-[#6A7B9D] md:text-lg">
            Interactive and recorded demonstrations of CAD interoperability, NEXiQ non-emergency
            automation, and campus safety reportingbuilt from the same platform agencies evaluate
            in a structured pilot.
          </p>
        </div>
      </div>
      <FeatureCadInterop />
      <SectionDivider />
      <FeatureNonEmergency />
      <SectionDivider />
      <FeatureCampusSafety />
    </div>
  );
}

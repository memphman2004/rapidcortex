import {
  isCadWritebackUiEnabled,
  isChannelMonitoringEnabled,
  isNonEmergencyTriageEnabled,
  isQaScoringEnabled,
  isSlaBacklogEnabled,
  isVerticalOnboardingEnabled,
} from "@/lib/runtime-flags";

/** Runtime feature gates for `NavItem.feature` keys in role-nav.ts. */
export function isNavFeatureEnabled(feature: string): boolean {
  switch (feature) {
    case "cadWriteback":
      return isCadWritebackUiEnabled();
    case "qaScoringEnabled":
      return isQaScoringEnabled();
    case "slaBacklog":
      return isSlaBacklogEnabled();
    case "nonEmergencyTriage":
      return isNonEmergencyTriageEnabled();
    case "channelMonitoring":
      return isChannelMonitoringEnabled();
    case "verticalOnboarding":
      return isVerticalOnboardingEnabled();
    default:
      return true;
  }
}

import {
  isCadWritebackUiEnabled,
  isChannelMonitoringEnabled,
  isDeploymentsMapEnabled,
  isNonEmergencyTriageEnabled,
  isQaScoringEnabled,
  isSalesLeadsUiEnabled,
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
    case "salesLeads":
      return isSalesLeadsUiEnabled();
    case "deploymentsMap":
      return isDeploymentsMapEnabled();
    default:
      return true;
  }
}

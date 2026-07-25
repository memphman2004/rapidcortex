import {
  isCadWritebackUiEnabled,
  isChannelMonitoringEnabled,
  isDeploymentsMapEnabled,
  isNonEmergencyTriageEnabled,
  isNg911AssistEnabled,
  isQaScoringEnabled,
  isRcsEnabled,
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
    case "ng911Assist":
      return isNg911AssistEnabled();
    case "channelMonitoring":
      return isChannelMonitoringEnabled();
    case "verticalOnboarding":
      return isVerticalOnboardingEnabled();
    case "salesLeads":
      return isSalesLeadsUiEnabled();
    case "deploymentsMap":
      return isDeploymentsMapEnabled();
    case "rcs":
      return isRcsEnabled();
    default:
      return true;
  }
}

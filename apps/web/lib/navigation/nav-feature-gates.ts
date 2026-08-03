import {
  isCadWritebackUiEnabled,
  isCampusCleryEnabled,
  isChannelMonitoringEnabled,
  isDeploymentsMapEnabled,
  isNonEmergencyTriageEnabled,
  isNg911AssistEnabled,
  isQaScoringEnabled,
  isRcsEnabled,
  isHiringUiEnabled,
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
    case "hiring":
      return isHiringUiEnabled();
    case "deploymentsMap":
      return isDeploymentsMapEnabled();
    case "rcs":
      return isRcsEnabled();
    case "campusClery":
      return isCampusCleryEnabled();
    default:
      return true;
  }
}

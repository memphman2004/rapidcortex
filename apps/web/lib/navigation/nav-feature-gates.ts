import {
  isCadWritebackUiEnabled,
  isCadConnectorUiEnabled,
  isCampusCleryEnabled,
  isCampusEapEnabled,
  isChannelMonitoringEnabled,
  isDeploymentsMapEnabled,
  isNonEmergencyTriageEnabled,
  isNg911AssistEnabled,
  isQaScoringEnabled,
  isRcsEnabled,
  isHiringUiEnabled,
  isPsapProspectsUiEnabled,
  isContactsModuleUiEnabled,
  isRapidIqUiEnabled,
  isRapidIqPipelineUiEnabled,
  isSalesAutomationUiEnabled,
  isConferencesUiEnabled,
  isSalesLeadsUiEnabled,
  isSlaBacklogEnabled,
  isTransitCamerasUiEnabled,
  isVerticalOnboardingEnabled,
  isWarRoomsEnabled,
} from "@/lib/runtime-flags";
import { isVerticalEnabled } from "@/lib/features";

/** Runtime feature gates for `NavItem.feature` keys in role-nav.ts. */
export function isNavFeatureEnabled(feature: string): boolean {
  switch (feature) {
    case "cadWriteback":
      return isCadWritebackUiEnabled();
    case "cadConnector":
      return isCadConnectorUiEnabled();
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
    case "psapProspects":
      return isPsapProspectsUiEnabled();
    case "rapidIq":
      return isRapidIqUiEnabled();
    case "rapidIqPipeline":
      return isRapidIqPipelineUiEnabled();
    case "salesAutomation":
      return isSalesAutomationUiEnabled();
    case "conferences":
      return isConferencesUiEnabled();
    case "contactsModule":
      return isContactsModuleUiEnabled();
    case "hiring":
      return isHiringUiEnabled();
    case "deploymentsMap":
      return isDeploymentsMapEnabled();
    case "rcs":
      return isRcsEnabled();
    case "campusClery":
      return isCampusCleryEnabled();
    case "campusEap":
      return isCampusEapEnabled();
    case "warRooms":
      return isWarRoomsEnabled();
    case "verticalTransit":
      return isVerticalEnabled("transit");
    case "transitCameras":
      return isVerticalEnabled("transit") && isTransitCamerasUiEnabled();
    default:
      return true;
  }
}

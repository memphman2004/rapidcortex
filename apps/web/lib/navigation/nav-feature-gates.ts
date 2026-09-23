import {
  isCadWritebackUiEnabled,
  isCadConnectorUiEnabled,
  isCadBridgeUiEnabled,
  isC2cHubUiEnabled,
  isCampusCleryEnabled,
  isCleryModuleEnabled,
  isCampusEapEnabled,
  isChannelMonitoringEnabled,
  isDeploymentsMapEnabled,
  isNonEmergencyTriageEnabled,
  isSopIntelligenceEnabled,
  isNg911AssistEnabled,
  isCallAssistEnabled,
  isRcTranslateCampusEnabled,
  isRcTranslateEnabled,
  isRcTranslateHospitalEnabled,
  isRapidVisionEnabled,
  isRapidVisionSceneIntelEnabled,
  isRcTranslateVenueEnabled,
  isVerticalAlertsEnabled,
  isEnsTestProgramEnabled,
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
  isSupportFormUiEnabled,
  isSlaBacklogEnabled,
  isTransitCamerasUiEnabled,
  isRcVideoEnabled,
  isAutomatedInvoicesEnabled,
  isVerticalOnboardingEnabled,
  isWarRoomsEnabled,
  isScenarioCenterUiEnabled,
  isStaffGuideEnabled,
} from "@/lib/runtime-flags";
import { isVerticalEnabled } from "@/lib/features";

/** Runtime feature gates for `NavItem.feature` keys in role-nav.ts. */
export function isNavFeatureEnabled(feature: string): boolean {
  switch (feature) {
    case "cadWriteback":
      return isCadWritebackUiEnabled();
    case "cadConnector":
      return isCadConnectorUiEnabled();
    case "cadBridge":
      return isCadBridgeUiEnabled();
    case "c2cHub":
      return isC2cHubUiEnabled();
    case "qaScoringEnabled":
      return isQaScoringEnabled();
    case "slaBacklog":
      return isSlaBacklogEnabled();
    case "nonEmergencyTriage":
      return isNonEmergencyTriageEnabled();
    case "sopIntelligence":
      return isSopIntelligenceEnabled();
    case "ng911Assist":
      return isNg911AssistEnabled();
    case "callAssist":
      return isCallAssistEnabled();
    case "rcTranslate":
      return isRcTranslateEnabled();
    case "rcTranslateVenue":
      return isRcTranslateEnabled() && isRcTranslateVenueEnabled();
    case "rcTranslateCampus":
      return isRcTranslateEnabled() && isRcTranslateCampusEnabled();
    case "rcTranslateHospital":
      return isRcTranslateEnabled() && isRcTranslateHospitalEnabled();
    case "rapidVision":
      return isRapidVisionEnabled();
    case "rapidVisionSceneIntel":
      return isRapidVisionSceneIntelEnabled();
    case "verticalAlerts":
      return isVerticalAlertsEnabled();
    case "ensTestProgram":
      return isVerticalAlertsEnabled() && isEnsTestProgramEnabled();
    case "channelMonitoring":
      return isChannelMonitoringEnabled();
    case "verticalOnboarding":
      return isVerticalOnboardingEnabled();
    case "salesLeads":
      return isSalesLeadsUiEnabled();
    case "supportForm":
      return isSupportFormUiEnabled();
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
    case "cleryModule":
      return isCleryModuleEnabled();
    case "campusEap":
      return isCampusEapEnabled();
    case "warRooms":
      return isWarRoomsEnabled();
    case "verticalTransit":
      return isVerticalEnabled("transit");
    case "transitCameras":
      return isVerticalEnabled("transit") && isTransitCamerasUiEnabled();
    case "rcVideo":
      return isRcVideoEnabled();
    case "automatedInvoices":
      return isAutomatedInvoicesEnabled();
    case "scenarioCenter":
      return isScenarioCenterUiEnabled();
    case "staffGuide":
      return isStaffGuideEnabled();
    default:
      return true;
  }
}

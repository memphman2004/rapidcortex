/**
 * Permission string constants for the features suite.
 * Registered in packages/security separately — handlers pass these to
 * AuthorizationService.canPerform().
 *
 * Audit event names: import FEATURES_AUDIT_EVENT_TYPES from rapid-cortex-shared.
 */

export const FEATURE_PERMISSIONS = {
  citizensView: "features.citizens.view",
  citizensManage: "features.citizens.manage",
  addressIntelView: "features.address_intel.view",
  addressIntelManage: "features.address_intel.manage",
  altResponseView: "features.alt_response.view",
  altResponseDecide: "features.alt_response.decide",
  mutualAidView: "features.mutual_aid.view",
  mutualAidManage: "features.mutual_aid.manage",
  mciView: "features.mci.view",
  mciManage: "features.mci.manage",
  infraView: "features.infra.view",
  infraManage: "features.infra.manage",
  interpreterView: "features.interpreter.view",
  interpreterManage: "features.interpreter.manage",
  evidenceView: "features.evidence.view",
  evidenceManage: "features.evidence.manage",
  assessmentView: "features.assessment.view",
  assessmentManage: "features.assessment.manage",
  learningView: "features.learning.view",
  learningManage: "features.learning.manage",
  surgeView: "features.surge.view",
  surgeManage: "features.surge.manage",
  checkinView: "features.checkin.view",
  checkinManage: "features.checkin.manage",
  socialView: "features.social.view",
  socialManage: "features.social.manage",
} as const;

export type FeaturePermission =
  (typeof FEATURE_PERMISSIONS)[keyof typeof FEATURE_PERMISSIONS];

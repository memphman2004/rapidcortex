export const ONBOARDING_CHECKLIST_SHARED_STEP_IDS = [
  "intake_questionnaire_completed",
  "org_config_confirmed",
  "agency_admin_created",
  "staff_users_invited",
  "mfa_enabled",
  "sms_number_registered",
  "test_sms_sent",
  "tenant_isolation_verified",
  "audit_log_confirmed",
  "staff_dashboard_walkthrough",
] as const;

export const ONBOARDING_CHECKLIST_CAMPUS_STEP_IDS = [
  "campus_map_uploaded",
  "rcli_locations_created",
  "qr_codes_downloaded",
  "signs_printed",
  "nfc_tags_programmed",
  "anonymous_reporting_confirmed",
  "clery_contact_notified",
  "tabletop_scenario_completed",
] as const;

export const ONBOARDING_CHECKLIST_VENUE_STEP_IDS = [
  "section_map_uploaded",
  "rcli_locations_created",
  "qr_codes_downloaded",
  "signs_printed",
  "nfc_tags_programmed",
  "event_calendar_entered",
  "guest_services_routing_confirmed",
  "ada_coordinator_notified",
  "tabletop_scenario_completed",
] as const;

export type OnboardingChecklistSharedStepId =
  (typeof ONBOARDING_CHECKLIST_SHARED_STEP_IDS)[number];

export type OnboardingChecklistCampusStepId =
  (typeof ONBOARDING_CHECKLIST_CAMPUS_STEP_IDS)[number];

export type OnboardingChecklistVenueStepId =
  (typeof ONBOARDING_CHECKLIST_VENUE_STEP_IDS)[number];

export type OnboardingChecklistStepId =
  | OnboardingChecklistSharedStepId
  | OnboardingChecklistCampusStepId
  | OnboardingChecklistVenueStepId;

export type OnboardingVertical = "campus" | "venue";

export type OnboardingChecklistStepStatus = "pending" | "complete";

export type OnboardingChecklistState = {
  orgCode: string;
  vertical: OnboardingVertical;
  agencyId: string;
  steps: Partial<Record<OnboardingChecklistStepId, OnboardingChecklistStepStatus>>;
  notesByStep?: Partial<Record<OnboardingChecklistStepId, string>>;
  updatedAt: string;
  updatedBy?: string;
};

export type AgencyOnboardingMilestone = {
  id: string;
  text: string;
  docFile?: string;
  adminPath?: string;
};

/**
 * Ordered milestones from signed pilot → steady-state support.
 * Tracked in-browser on Admin → Pilot hub (localStorage); not a server-side audit record.
 */
export const AGENCY_ONBOARDING_MILESTONES: AgencyOnboardingMilestone[] = [
  {
    id: "ms-kickoff",
    text: "Pilot kickoff meeting complete; decisions captured in implementation workbook.",
    docFile: "PILOT_KICKOFF_CHECKLIST.md",
  },
  {
    id: "ms-inputs",
    text: "Agency inputs collected (contacts, slug, privacy, protocol, multilingual scope, user-role list).",
    docFile: "IMPLEMENTATION_WORKBOOK_TEMPLATE.md",
  },
  {
    id: "ms-technical",
    text: "Technical baseline: stack + web env + CORS + Cognito aligned for pilot URLs.",
    docFile: "AGENCY_ONBOARDING_RUNBOOK.md",
  },
  {
    id: "ms-checkpoints",
    text: "Privacy / retention, protocol, multilingual, and role-mapping checkpoints signed.",
    docFile: "AGENCY_SETUP_CHECKLIST.md",
  },
  {
    id: "ms-admins",
    text: "Agency admin accounts live; Pilot hub, Configuration, and Integrations smoke-tested.",
    adminPath: "/admin/configuration",
    docFile: "ADMIN_SETUP_GUIDE.md",
  },
  {
    id: "ms-users",
    text: "Pilot dispatchers/supervisors provisioned with correct JWT claims.",
    adminPath: "/admin/users",
    docFile: "ADMIN_GUIDE.md",
  },
  {
    id: "ms-train",
    text: "Training session delivered (or scheduled with materials sent).",
    docFile: "TRAINING_QUICKSTART.md",
  },
  {
    id: "ms-validate",
    text: "Pilot validation / go-live smoke checklist executed.",
    docFile: "PILOT_VALIDATION_CHECKLIST.md",
  },
  {
    id: "ms-support",
    text: "Support model and escalation path confirmed with agency desk.",
    docFile: "SUPPORT_MODEL.md",
  },
  {
    id: "ms-feedback",
    text: "Pilot success / feedback retro cadence agreed.",
    docFile: "PILOT_SUCCESS_AND_FEEDBACK.md",
  },
];

export const AGENCY_MILESTONE_STORAGE_KEY = "rc-agency-onboarding-milestones-v1";

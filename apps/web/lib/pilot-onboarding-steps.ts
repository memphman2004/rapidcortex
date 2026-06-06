export type PilotChecklistItem = {
  id: string;
  text: string;
  /** Markdown file name under repository `docs/` (e.g. `PILOT_READINESS_CHECKLIST.md`). */
  docFile?: string;
  /** In-app path after jurisdiction slug, e.g. `/admin/users`. */
  adminPath?: string;
};

export type PilotPhase = {
  id: string;
  title: string;
  description: string;
  items: PilotChecklistItem[];
};

export const PILOT_ONBOARDING_PHASES: PilotPhase[] = [
  {
    id: "intro",
    title: "Introduce & align scope",
    description:
      "Sales, solutions, and agency leadership agree on assistive posture and written boundaries before technical work.",
    items: [
      {
        id: "intro-product-overview",
        text: "Sales / buyer narrative aligned with product overview and feature maturity (no oversell).",
        docFile: "PRODUCT_OVERVIEW.md",
      },
      {
        id: "intro-sow",
        text: "Pilot agreement / SOW reflects assistive AI and human-in-the-loop (not autonomous dispatch).",
        docFile: "PILOT_GOVERNANCE.md",
      },
      {
        id: "intro-mvp",
        text: "Stakeholders reviewed MVP scope and explicit non-goals.",
        docFile: "MVP_SCOPE.md",
      },
      {
        id: "intro-non-goals",
        text: "Out-of-scope items (CAD as SoR, certifications, etc.) acknowledged.",
        docFile: "NON_GOALS.md",
      },
      {
        id: "intro-sales-matrix",
        text: "Sales / SE team aligned on promise vs out-of-scope matrix.",
        docFile: "SALES_SCOPE_MATRIX.md",
      },
    ],
  },
  {
    id: "configure",
    title: "Configure tenant & environments",
    description: "Engineering and agency IT wire Cognito, API, and web env for the pilot stack.",
    items: [
      {
        id: "cfg-runbook",
        text: "Agency onboarding runbook in progress: inputs, owners, and technical checkpoints tracked.",
        docFile: "AGENCY_ONBOARDING_RUNBOOK.md",
      },
      {
        id: "cfg-matrix",
        text: "Environment matrix and web env vars match the target stage (proxy + upstream URL).",
        docFile: "ENVIRONMENT_MATRIX.md",
      },
      {
        id: "cfg-install",
        text: "Installation and deploy runbook steps executed for this host.",
        docFile: "INSTALLATION.md",
      },
      {
        id: "cfg-demo-mode",
        text: "Pilot web host does not use offline mock incident mode unless explicitly a sandbox.",
        docFile: "NON_GOALS.md",
      },
      {
        id: "cfg-integrations",
        text: "Admin verified integration status panel after authenticated deploy.",
        adminPath: "/admin/integrations",
      },
    ],
  },
  {
    id: "admin",
    title: "Admin setup & provisioning",
    description: "Agency admins invite users, assign roles, and validate audit posture.",
    items: [
      {
        id: "adm-users",
        text: "Users created with correct custom:agencyId and custom:role.",
        adminPath: "/admin/users",
        docFile: "COGNITO_SELF_SIGNUP.md",
      },
      {
        id: "adm-audit",
        text: "Audit access policy agreed with legal / IT; audit UI spot-checked.",
        adminPath: "/admin/audit",
        docFile: "AUDIT_EVENT_MATRIX.md",
      },
      {
        id: "adm-settings",
        text: "Environment reference reviewed for compliance and retention expectations.",
        adminPath: "/admin/settings",
        docFile: "PRIVACY_RETENTION_DECISIONS.md",
      },
    ],
  },
  {
    id: "train",
    title: "Train staff",
    description: "Dispatchers, supervisors, and admins complete pilot training paths.",
    items: [
      {
        id: "train-quickstart",
        text: "Trainer delivered session using training quickstart and user guide.",
        docFile: "TRAINING_QUICKSTART.md",
      },
      {
        id: "train-dispatcher",
        text: "Dispatcher checklist completed (or equivalent SOP sign-off).",
        docFile: "training/PILOT_DISPATCHER_CHECKLIST.md",
      },
      {
        id: "train-admin",
        text: "Agency admin checklist completed.",
        docFile: "training/PILOT_AGENCY_ADMIN_CHECKLIST.md",
      },
    ],
  },
  {
    id: "launch",
    title: "Launch & validate",
    description: "Controlled go-live with technical and operational smoke checks.",
    items: [
      {
        id: "launch-readiness",
        text: "Master pilot readiness checklist signed off.",
        docFile: "PILOT_READINESS_CHECKLIST.md",
      },
      {
        id: "launch-validation",
        text: "Pilot validation checklist (stack + functional smoke) executed.",
        docFile: "PILOT_VALIDATION_CHECKLIST.md",
      },
      {
        id: "launch-limitations",
        text: "Known limitations distributed to floor supervisors.",
        docFile: "KNOWN_LIMITATIONS.md",
      },
    ],
  },
  {
    id: "support",
    title: "Support & feedback",
    description: "Ongoing pilot support, ticket routing, and structured feedback into product.",
    items: [
      {
        id: "sup-model",
        text: "Support model and escalation paths shared with agency desk.",
        docFile: "SUPPORT_MODEL.md",
      },
      {
        id: "sup-incident",
        text: "Security / outage response contacts understood.",
        docFile: "INCIDENT_RESPONSE.md",
      },
      {
        id: "sup-playbook",
        text: "Per-agency playbook template filled (URLs, contacts, escalation).",
        docFile: "AGENCY_PLAYBOOK_TEMPLATE.md",
      },
    ],
  },
];

export const PILOT_CHECKLIST_STORAGE_KEY = "rc-pilot-onboarding-checklist-v1";

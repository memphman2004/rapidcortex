/**
 * NEXiQ City Services — Department Playbook Engine
 *
 * Versioned configuration for each municipal department. Wraps the existing
 * MUNICIPAL_ISSUES / LEX_INTENT_DEPARTMENT routing in municipal-services.ts.
 * Does NOT replace that routing — it augments it with structured metadata and
 * citizen-facing resolution guidance.
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 *
 * Gate: only active when `config.municipalServiceExpansionEnabled === true`.
 *       Existing routing continues unchanged when the flag is off.
 *
 * Version history:
 *   v1.0 — Phase 2 initial playbooks for 14 departments.
 */

import type { MunicipalDepartmentId } from "./municipal-services.js";

export const PLAYBOOK_SCHEMA_VERSION = "1.0" as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlaybookFieldType =
  | "address"      // Street address with city/ZIP
  | "text"         // Free-form text
  | "phone"        // E.164 phone number
  | "yesno"        // Boolean yes/no
  | "select"       // Single choice from options
  | "photo"        // Photo/media upload hint
  | "date";        // Date (YYYY-MM-DD)

export type PlaybookField = {
  name: string;
  label: string;
  type: PlaybookFieldType;
  required: boolean;
  options?: string[];  // For 'select' type
  voicePrompt: string; // What Nova / Lex asks the caller
};

export type PlaybookResolutionStep = {
  order: number;
  description: string;
  citizenVisible: boolean;  // Whether to share this step in citizen-facing updates
};

/**
 * Versioned playbook for one municipal department.
 *
 * Fields are ordered to match what voice intake collects.
 * `citizenConfirmation` is the SMS/voice text sent after a new SR is created;
 *   use `{confirmationNumber}` and `{department}` as placeholders.
 */
export type DepartmentPlaybook = {
  /** Semver string identifying the playbook revision. */
  version: string;
  departmentId: MunicipalDepartmentId;
  displayName: string;
  /** Citizen-facing phone number for this department, if published. */
  publicPhone?: string;
  /** Department website or online reporting URL. */
  website?: string;
  /** Fields collected during intake. Address is first unless overridden. */
  intakeFields: PlaybookField[];
  /** Default SLA in minutes. Used for status readout math. */
  defaultSlaMinutes: number;
  /** Template for the confirmation SMS/voice text. */
  citizenConfirmation: string;
  /** Internal resolution steps shown in the supervisor console. */
  resolutionSteps: PlaybookResolutionStep[];
  /**
   * Condition under which an SR for this department may be automatically
   * escalated without reaching the 24h cap. E.g. "flooding" issues.
   */
  autoEscalateIfKeywords?: string[];
  /** Transfer prompt for when a human operator should take over. */
  transferPrompt?: string;
  /** Supported languages beyond en-US. */
  supportedLanguages?: string[];
};

// ---------------------------------------------------------------------------
// Built-in playbooks for 14 live departments
// ---------------------------------------------------------------------------

const ADDRESS_FIELD: PlaybookField = {
  name: "incidentLocation",
  label: "Location / Address",
  type: "address",
  required: true,
  voicePrompt: "What is the address or cross streets where the issue is?",
};

const CALLBACK_FIELD: PlaybookField = {
  name: "callbackNumber",
  label: "Callback number",
  type: "phone",
  required: false,
  voicePrompt: "What is the best number to reach you if we have questions?",
};

const NOTES_FIELD: PlaybookField = {
  name: "notes",
  label: "Additional details",
  type: "text",
  required: false,
  voicePrompt: "Any additional details that might help the crew?",
};

const PHOTO_FIELD: PlaybookField = {
  name: "photoUrl",
  label: "Photo (optional)",
  type: "photo",
  required: false,
  voicePrompt: "If you have a photo, you can text it to our SMS line.",
};

function confirmation(dept: string): string {
  return (
    `Your report {confirmationNumber} has been received by ${dept}. ` +
    `Keep this number to check the status or add details later. ` +
    `Emergencies: call 911.`
  );
}

export const DEPARTMENT_PLAYBOOKS: DepartmentPlaybook[] = [
  // -------------------------------------------------------------------------
  // 1. Public Works
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "PUBLIC_WORKS",
    displayName: "Public Works",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "issueType",
        label: "Issue type",
        type: "select",
        required: true,
        options: [
          "Pothole",
          "Sidewalk damage",
          "Street collapse / sinkhole",
          "Guardrail damage",
          "Missing manhole cover",
          "Street flooding",
          "Debris in road",
          "Road striping / sign",
          "Other",
        ],
        voicePrompt: "Is this a pothole, sidewalk issue, road damage, flooding, debris, or something else?",
      },
      PHOTO_FIELD,
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 480,
    citizenConfirmation: confirmation("Public Works"),
    resolutionSteps: [
      { order: 1, description: "SR logged and triaged by 311 intake", citizenVisible: false },
      { order: 2, description: "Public Works crew assigned", citizenVisible: true },
      { order: 3, description: "Inspection or repair scheduled", citizenVisible: true },
      { order: 4, description: "Repair completed", citizenVisible: true },
    ],
    autoEscalateIfKeywords: ["flooding", "sinkhole", "collapse", "missing manhole"],
    transferPrompt: "I'm connecting you with Public Works now.",
    supportedLanguages: ["es-US"],
  },

  // -------------------------------------------------------------------------
  // 2. Public Works Electrical (signals & streetlights)
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "PUBLIC_WORKS_ELECTRICAL",
    displayName: "Traffic Signals & Street Lighting",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "electricalType",
        label: "Electrical issue",
        type: "select",
        required: true,
        options: ["Street light out", "Traffic signal issue", "Walk signal broken", "Flashing signal", "Other"],
        voicePrompt: "Is this a streetlight out, traffic signal problem, or walk signal issue?",
      },
      {
        name: "isBlinking",
        label: "Flashing / blinking?",
        type: "yesno",
        required: false,
        voicePrompt: "Is the signal currently flashing or blinking?",
      },
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 240,
    citizenConfirmation: confirmation("Traffic Signals & Street Lighting"),
    resolutionSteps: [
      { order: 1, description: "Signal or light outage logged", citizenVisible: false },
      { order: 2, description: "Electrical crew dispatched", citizenVisible: true },
      { order: 3, description: "Issue repaired", citizenVisible: true },
    ],
    autoEscalateIfKeywords: ["intersection dark", "all signals out", "no lights at all"],
    transferPrompt: "I'm connecting you with our electrical division.",
  },

  // -------------------------------------------------------------------------
  // 3. Sanitation
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "SANITATION",
    displayName: "Sanitation & Waste Management",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "sanitationType",
        label: "Sanitation issue",
        type: "select",
        required: true,
        options: [
          "Missed trash pickup",
          "Missed recycling",
          "Missed bulk / heavy items",
          "Illegal dumping",
          "Overflowing public bin",
          "Dead animal",
          "Other",
        ],
        voicePrompt: "Is this a missed pickup, illegal dumping, overflowing trash can, or something else?",
      },
      PHOTO_FIELD,
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 1440,
    citizenConfirmation: confirmation("Sanitation"),
    resolutionSteps: [
      { order: 1, description: "Sanitation request logged", citizenVisible: false },
      { order: 2, description: "Scheduled for next route or same-day pickup", citizenVisible: true },
      { order: 3, description: "Completed", citizenVisible: true },
    ],
    transferPrompt: "I'm connecting you with Sanitation.",
    supportedLanguages: ["es-US"],
  },

  // -------------------------------------------------------------------------
  // 4. Water & Sewer Authority
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "WATER_SEWER_AUTHORITY",
    displayName: "Water & Sewer",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "waterType",
        label: "Water issue",
        type: "select",
        required: true,
        options: [
          "Water main break",
          "No water / low pressure",
          "Water quality / color / odor",
          "Sewage backup",
          "Flooded street from main",
          "Fire hydrant damage",
          "Meter issue",
          "Other",
        ],
        voicePrompt: "Is this a water main break, sewage backup, no water, water quality issue, or something else?",
      },
      {
        name: "isWaterRunning",
        label: "Active leak / water running?",
        type: "yesno",
        required: false,
        voicePrompt: "Is water actively flowing or gushing right now?",
      },
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 240,
    citizenConfirmation: confirmation("Water & Sewer"),
    resolutionSteps: [
      { order: 1, description: "Water or sewer issue logged", citizenVisible: false },
      { order: 2, description: "Utility crew dispatched for inspection", citizenVisible: true },
      { order: 3, description: "Repair completed", citizenVisible: true },
    ],
    autoEscalateIfKeywords: [
      "water gushing",
      "water main broke",
      "sewage in street",
      "sewage in house",
      "basement flooding",
    ],
    transferPrompt: "I'm connecting you with Water & Sewer.",
    supportedLanguages: ["es-US"],
  },

  // -------------------------------------------------------------------------
  // 5. Code Enforcement
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "CODE_ENFORCEMENT",
    displayName: "Code Enforcement",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "violationType",
        label: "Violation type",
        type: "select",
        required: true,
        options: [
          "Overgrown grass / weeds",
          "Junk / abandoned vehicle on property",
          "Trash / debris on property",
          "Unsafe structure",
          "Unlicensed construction",
          "Commercial activity in residential zone",
          "Other",
        ],
        voicePrompt: "What type of code violation are you reporting — overgrown yard, junk vehicle, unsafe structure, or something else?",
      },
      {
        name: "propertyOwnership",
        label: "Property type",
        type: "select",
        required: false,
        options: ["Residential", "Commercial", "Vacant lot"],
        voicePrompt: "Is this a residential, commercial, or vacant property?",
      },
      PHOTO_FIELD,
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 1440,
    citizenConfirmation: confirmation("Code Enforcement"),
    resolutionSteps: [
      { order: 1, description: "Violation report logged", citizenVisible: false },
      { order: 2, description: "Inspector assigned", citizenVisible: true },
      { order: 3, description: "Inspection conducted", citizenVisible: true },
      { order: 4, description: "Notice issued or case closed", citizenVisible: true },
    ],
    transferPrompt: "I'm connecting you with Code Enforcement.",
  },

  // -------------------------------------------------------------------------
  // 6. Parking Enforcement
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "PARKING_ENFORCEMENT",
    displayName: "Parking Enforcement",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "vehicleDescription",
        label: "Vehicle description",
        type: "text",
        required: false,
        voicePrompt: "Can you describe the vehicle — make, color, or license plate?",
      },
      {
        name: "parkingViolation",
        label: "Violation",
        type: "select",
        required: true,
        options: [
          "Blocking driveway",
          "Fire hydrant",
          "No parking zone",
          "Handicap zone",
          "Expired tags / abandoned",
          "Double parked",
          "Other",
        ],
        voicePrompt: "Is the vehicle blocking a driveway, fire hydrant, in a no-parking zone, or something else?",
      },
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 120,
    citizenConfirmation: confirmation("Parking Enforcement"),
    resolutionSteps: [
      { order: 1, description: "Parking complaint logged", citizenVisible: false },
      { order: 2, description: "Officer dispatched for review", citizenVisible: true },
      { order: 3, description: "Citation issued or vehicle cleared", citizenVisible: true },
    ],
    autoEscalateIfKeywords: ["blocking fire truck", "blocking ambulance", "blocking hydrant"],
    transferPrompt: "I'm connecting you with Parking Enforcement.",
  },

  // -------------------------------------------------------------------------
  // 7. Animal Control
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "ANIMAL_CONTROL",
    displayName: "Animal Control",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "animalType",
        label: "Animal type",
        type: "text",
        required: true,
        voicePrompt: "What kind of animal is it — dog, cat, raccoon, stray, injured, or something else?",
      },
      {
        name: "isAggressive",
        label: "Aggressive / biting?",
        type: "yesno",
        required: true,
        voicePrompt: "Is the animal acting aggressively or has it bitten anyone?",
      },
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 60,
    citizenConfirmation: confirmation("Animal Control"),
    resolutionSteps: [
      { order: 1, description: "Animal complaint logged", citizenVisible: false },
      { order: 2, description: "Animal Control officer dispatched", citizenVisible: true },
      { order: 3, description: "Animal secured or owner contacted", citizenVisible: true },
    ],
    autoEscalateIfKeywords: ["attacking", "biting", "dangerous animal", "someone was bit"],
    transferPrompt: "I'm connecting you with Animal Control.",
    supportedLanguages: ["es-US"],
  },

  // -------------------------------------------------------------------------
  // 8. Urban Forestry
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "URBAN_FORESTRY",
    displayName: "Urban Forestry",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "treeIssue",
        label: "Tree issue",
        type: "select",
        required: true,
        options: [
          "Dead / hazardous tree",
          "Fallen tree blocking road",
          "Fallen tree on private property",
          "Overgrown branches over road",
          "Storm damage",
          "Tree roots damaging sidewalk",
          "Other",
        ],
        voicePrompt: "Is this a fallen tree, hazardous tree, overgrown branches, or root damage?",
      },
      {
        name: "isBlocking",
        label: "Blocking road or access?",
        type: "yesno",
        required: false,
        voicePrompt: "Is the tree or branches blocking a road, driveway, or sidewalk?",
      },
      PHOTO_FIELD,
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 1440,
    citizenConfirmation: confirmation("Urban Forestry"),
    resolutionSteps: [
      { order: 1, description: "Tree report logged", citizenVisible: false },
      { order: 2, description: "Arborist crew assigned", citizenVisible: true },
      { order: 3, description: "Tree removed or trimmed", citizenVisible: true },
    ],
    autoEscalateIfKeywords: ["tree on power line", "tree on car", "blocking street", "road is blocked"],
    transferPrompt: "I'm connecting you with Urban Forestry.",
  },

  // -------------------------------------------------------------------------
  // 9. Parks & Recreation
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "PARKS_RECREATION",
    displayName: "Parks & Recreation",
    intakeFields: [
      {
        name: "parkName",
        label: "Park name",
        type: "text",
        required: true,
        voicePrompt: "What is the name or location of the park?",
      },
      {
        name: "parkIssue",
        label: "Park issue",
        type: "select",
        required: true,
        options: [
          "Playground equipment damaged",
          "Park light out",
          "Vandalism",
          "Overgrown / unmaintained",
          "Broken bench or structure",
          "Restroom issue",
          "Court surface damaged",
          "Unauthorized use",
          "Other",
        ],
        voicePrompt: "What is the issue — playground damage, lighting, vandalism, maintenance, or something else?",
      },
      PHOTO_FIELD,
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 1440,
    citizenConfirmation: confirmation("Parks & Recreation"),
    resolutionSteps: [
      { order: 1, description: "Parks report logged", citizenVisible: false },
      { order: 2, description: "Parks crew or inspector notified", citizenVisible: true },
      { order: 3, description: "Repair or maintenance completed", citizenVisible: true },
    ],
    transferPrompt: "I'm connecting you with Parks and Recreation.",
  },

  // -------------------------------------------------------------------------
  // 10. Environmental Quality
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "ENVIRONMENTAL_QUALITY",
    displayName: "Environmental Quality",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "envType",
        label: "Environmental issue",
        type: "select",
        required: true,
        options: [
          "Illegal dumping",
          "Chemical odor / unknown substance",
          "Stormwater pollution",
          "Illegal discharge into drain",
          "Contaminated water (not utility)",
          "Sewage odor outdoors",
          "Air quality / smoke / burning",
          "Other",
        ],
        voicePrompt: "Is this illegal dumping, a chemical odor, water pollution, or something else?",
      },
      PHOTO_FIELD,
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 480,
    citizenConfirmation: confirmation("Environmental Quality"),
    resolutionSteps: [
      { order: 1, description: "Environmental complaint logged", citizenVisible: false },
      { order: 2, description: "Inspector dispatched", citizenVisible: true },
      { order: 3, description: "Site assessment completed", citizenVisible: true },
    ],
    autoEscalateIfKeywords: [
      "chemical spill",
      "hazmat",
      "unknown substance",
      "people are sick",
      "children affected",
    ],
    transferPrompt: "I'm connecting you with Environmental Quality.",
  },

  // -------------------------------------------------------------------------
  // 11. Housing & Community Development
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "HOUSING_COMMUNITY_DEV",
    displayName: "Housing & Community Development",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "housingIssue",
        label: "Housing issue",
        type: "select",
        required: true,
        options: [
          "No heat / heat not working",
          "No hot water",
          "Pest infestation",
          "Mold / mildew",
          "Unsafe building conditions",
          "Elevator out of service",
          "Overcrowding complaint",
          "Other",
        ],
        voicePrompt: "Is this a heat, water, pest, mold, elevator, or other housing issue?",
      },
      {
        name: "isTenant",
        label: "Are you the tenant?",
        type: "yesno",
        required: false,
        voicePrompt: "Are you the tenant affected, or are you reporting on behalf of someone else?",
      },
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 1440,
    citizenConfirmation: confirmation("Housing & Community Development"),
    resolutionSteps: [
      { order: 1, description: "Housing complaint logged", citizenVisible: false },
      { order: 2, description: "Housing inspector assigned", citizenVisible: true },
      { order: 3, description: "Inspection completed", citizenVisible: true },
      { order: 4, description: "Violation notice issued or case closed", citizenVisible: true },
    ],
    transferPrompt: "I'm connecting you with Housing and Community Development.",
  },

  // -------------------------------------------------------------------------
  // 12. Social Services
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "SOCIAL_SERVICES",
    displayName: "Social Services",
    intakeFields: [
      ADDRESS_FIELD,
      {
        name: "serviceType",
        label: "Service needed",
        type: "select",
        required: true,
        options: [
          "Homelessness outreach",
          "Mental health referral",
          "Domestic violence referral",
          "Substance use referral",
          "Food assistance",
          "Senior services",
          "Disability services",
          "Utility / rent assistance",
          "Immigration services info",
          "Other",
        ],
        voicePrompt: "What type of social service is needed — outreach, mental health, food assistance, or something else?",
      },
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 240,
    citizenConfirmation: confirmation("Social Services"),
    resolutionSteps: [
      { order: 1, description: "Social services request logged", citizenVisible: false },
      { order: 2, description: "Outreach worker or coordinator notified", citizenVisible: true },
      { order: 3, description: "Contact made or referral completed", citizenVisible: true },
    ],
    transferPrompt: "I'm connecting you with Social Services.",
    supportedLanguages: ["es-US", "fr-FR"],
  },

  // -------------------------------------------------------------------------
  // 13. Transit Authority
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "TRANSIT_AUTHORITY",
    displayName: "Transit Authority",
    intakeFields: [
      {
        name: "stopOrRoute",
        label: "Stop or route",
        type: "text",
        required: false,
        voicePrompt: "What bus stop, route number, or station are you reporting about?",
      },
      {
        name: "transitIssue",
        label: "Transit issue",
        type: "select",
        required: true,
        options: [
          "Bus shelter damaged",
          "Bench missing",
          "Real-time sign not working",
          "Graffiti on transit property",
          "Bike share station broken",
          "Scooter blocking sidewalk",
          "Bus stop sign missing",
          "Route / schedule question",
          "Other",
        ],
        voicePrompt: "Is this a shelter, bench, sign, graffiti, bike share, or other transit issue?",
      },
      PHOTO_FIELD,
      NOTES_FIELD,
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 480,
    citizenConfirmation: confirmation("Transit Authority"),
    resolutionSteps: [
      { order: 1, description: "Transit complaint logged", citizenVisible: false },
      { order: 2, description: "Transit maintenance crew notified", citizenVisible: true },
      { order: 3, description: "Issue repaired or removed", citizenVisible: true },
    ],
    transferPrompt: "I'm connecting you with the Transit Authority.",
  },

  // -------------------------------------------------------------------------
  // 14. 311 Operations (lifecycle and information requests)
  // -------------------------------------------------------------------------
  {
    version: PLAYBOOK_SCHEMA_VERSION,
    departmentId: "THREE11_OPERATIONS",
    displayName: "311 Customer Service",
    intakeFields: [
      {
        name: "requestType",
        label: "Request type",
        type: "select",
        required: true,
        options: [
          "Check status of existing report",
          "Reopen closed report",
          "Escalate unresolved issue",
          "Add information to report",
          "Correct address on report",
          "City office hours / locations",
          "Street closure information",
          "Other city information",
        ],
        voicePrompt: "Are you checking on an existing report, or do you have a general city information question?",
      },
      {
        name: "confirmationNumber",
        label: "Existing confirmation number",
        type: "text",
        required: false,
        voicePrompt: "Do you have your original report confirmation number?",
      },
      CALLBACK_FIELD,
    ],
    defaultSlaMinutes: 60,
    citizenConfirmation: confirmation("311 Customer Service"),
    resolutionSteps: [
      { order: 1, description: "311 request logged", citizenVisible: false },
      { order: 2, description: "311 coordinator reviewed", citizenVisible: true },
      { order: 3, description: "Information provided or case updated", citizenVisible: true },
    ],
    transferPrompt: "I'm connecting you with our 311 team.",
    supportedLanguages: ["es-US"],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const PLAYBOOK_BY_DEPT = new Map(DEPARTMENT_PLAYBOOKS.map((p) => [p.departmentId, p]));

/**
 * Returns the playbook for a department, or null when no playbook is registered.
 * When null, callers should fall back to the base municipal routing behavior.
 */
export function getPlaybookForDepartment(departmentId: string): DepartmentPlaybook | null {
  return PLAYBOOK_BY_DEPT.get(departmentId as MunicipalDepartmentId) ?? null;
}

/**
 * Returns the citizen-facing confirmation text for a service request,
 * substituting `{confirmationNumber}` and `{department}`.
 */
export function playbookConfirmationText(opts: {
  departmentId: string;
  confirmationNumber: string;
}): string {
  const playbook = getPlaybookForDepartment(opts.departmentId);
  const template = playbook?.citizenConfirmation ?? `Your report {confirmationNumber} has been received.`;
  return template
    .replace(/\{confirmationNumber\}/g, opts.confirmationNumber)
    .replace(/\{department\}/g, playbook?.displayName ?? "the city");
}

/**
 * Returns the default SLA minutes for a department, using the playbook
 * when available and the municipal-services default otherwise.
 */
export function playbookSlaMinutes(departmentId: string): number | undefined {
  return PLAYBOOK_BY_DEPT.get(departmentId as MunicipalDepartmentId)?.defaultSlaMinutes;
}

/**
 * Returns voice/intake fields for a department in the order they should be
 * collected. Returns an empty array when no playbook is registered.
 */
export function playbookIntakeFields(departmentId: string): PlaybookField[] {
  return PLAYBOOK_BY_DEPT.get(departmentId as MunicipalDepartmentId)?.intakeFields ?? [];
}

/**
 * Returns true when the utterance contains a keyword that warrants immediate
 * escalation for this department, bypassing the 24h cap.
 */
export function playbookAutoEscalate(departmentId: string, utterance: string): boolean {
  const playbook = PLAYBOOK_BY_DEPT.get(departmentId as MunicipalDepartmentId);
  if (!playbook?.autoEscalateIfKeywords?.length) return false;
  const lower = utterance.toLowerCase();
  return playbook.autoEscalateIfKeywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Returns the first voicePrompt text for a department — used by Nova as a
 * guided opening question after the issue type is known.
 */
export function playbookOpeningPrompt(departmentId: string): string | undefined {
  const fields = getPlaybookForDepartment(departmentId)?.intakeFields ?? [];
  return fields[0]?.voicePrompt;
}

/**
 * Returns all department IDs that have registered playbooks.
 * Useful for the admin dashboard to list configurable departments.
 */
export function listPlaybookDepartments(): MunicipalDepartmentId[] {
  return DEPARTMENT_PLAYBOOKS.map((p) => p.departmentId);
}

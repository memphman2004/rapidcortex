import type { CampusIncidentTypeConfig } from "./incident-types.js";

/** Parent categories for the K-12 concern picker (not a flat dropdown). */
export const K12_INCIDENT_GROUP_IDS = [
  "emergency_threats",
  "student_safety_wellness",
  "bullying_misconduct",
  "drugs_prohibited",
  "medical_health",
  "security_suspicious",
  "transport_facilities",
  "other_concerns",
] as const;

export type K12IncidentGroupId = (typeof K12_INCIDENT_GROUP_IDS)[number];

export type K12IncidentGroup = {
  id: K12IncidentGroupId;
  label: string;
  description: string;
};

export const K12_INCIDENT_GROUPS: readonly K12IncidentGroup[] = [
  {
    id: "emergency_threats",
    label: "Emergency & Threats",
    description: "Active danger, weapons, violence, fire, bomb, or immediate life-safety risk",
  },
  {
    id: "student_safety_wellness",
    label: "Student Safety & Wellness",
    description: "Welfare, self-harm, mental distress, abuse/neglect, missing or runaway student",
  },
  {
    id: "bullying_misconduct",
    label: "Bullying & Misconduct",
    description: "Bullying, harassment, sexual misconduct, hazing, bias, staff/student conduct",
  },
  {
    id: "drugs_prohibited",
    label: "Drugs & Prohibited Items",
    description: "Drugs, alcohol, vaping, tobacco, overdose, or poisoning",
  },
  {
    id: "medical_health",
    label: "Medical & Health",
    description: "Medical emergency or non-emergency injury / accident",
  },
  {
    id: "security_suspicious",
    label: "Security & Suspicious Activity",
    description: "Suspicious person/activity, unauthorized visitor, custody/pickup, access, tech",
  },
  {
    id: "transport_facilities",
    label: "Transportation & Facilities",
    description: "Bus, traffic, facility hazards, weather, events, vandalism, theft",
  },
  {
    id: "other_concerns",
    label: "Other Concerns",
    description: "Does not fit another category — free-text report",
  },
];

/** Map each K-12 type value → parent group. */
export const K12_TYPE_TO_GROUP: Record<string, K12IncidentGroupId> = {
  active_threat: "emergency_threats",
  weapon_concern: "emergency_threats",
  threat_of_violence: "emergency_threats",
  fight: "emergency_threats",
  fire_smoke: "emergency_threats",
  hazardous_material: "emergency_threats",
  bomb_threat: "emergency_threats",
  student_welfare: "student_safety_wellness",
  self_harm: "student_safety_wellness",
  mental_emotional_distress: "student_safety_wellness",
  abuse_neglect: "student_safety_wellness",
  missing_student: "student_safety_wellness",
  runaway_elopement: "student_safety_wellness",
  bullying: "bullying_misconduct",
  cyberbullying: "bullying_misconduct",
  harassment: "bullying_misconduct",
  sexual_misconduct: "bullying_misconduct",
  hazing: "bullying_misconduct",
  discrimination_bias: "bullying_misconduct",
  staff_conduct: "bullying_misconduct",
  student_conduct: "bullying_misconduct",
  drug_alcohol: "drugs_prohibited",
  overdose_poisoning: "drugs_prohibited",
  vaping_tobacco: "drugs_prohibited",
  medical_emergency: "medical_health",
  injury_accident: "medical_health",
  suspicious_person: "security_suspicious",
  unauthorized_visitor: "security_suspicious",
  suspicious_activity: "security_suspicious",
  security_access: "security_suspicious",
  cybersecurity: "security_suspicious",
  inappropriate_content: "security_suspicious",
  gang_related: "security_suspicious",
  trafficking_exploitation: "security_suspicious",
  custody_pickup: "security_suspicious",
  bus_transportation: "transport_facilities",
  traffic_parking: "transport_facilities",
  facility_hazard: "transport_facilities",
  vandalism: "transport_facilities",
  theft: "transport_facilities",
  animal_wildlife: "transport_facilities",
  severe_weather: "transport_facilities",
  event_athletic: "transport_facilities",
  other: "other_concerns",
};

export type K12FollowUpFieldType = "boolean" | "text" | "textarea" | "select";

export type K12FollowUpQuestion = {
  id: string;
  prompt: string;
  fieldType: K12FollowUpFieldType;
  required?: boolean;
  options?: readonly string[];
  /** Hint shown under the field. */
  helpText?: string;
};

/**
 * Type-specific intake questions. Missing types fall back to group defaults
 * via getK12FollowUpQuestions().
 */
export const K12_FOLLOW_UP_BY_TYPE: Record<string, readonly K12FollowUpQuestion[]> = {
  weapon_concern: [
    { id: "weapon_visible_now", prompt: "Is the weapon visible now?", fieldType: "boolean", required: true },
    {
      id: "weapon_type",
      prompt: "What type of weapon?",
      fieldType: "select",
      options: ["Firearm", "Knife", "Other bladed", "Improvised", "Ammunition only", "Unknown", "Social media only"],
      required: true,
    },
    { id: "person_location", prompt: "Where is the person / weapon?", fieldType: "text", required: true },
    { id: "person_description", prompt: "Describe the person", fieldType: "textarea", required: true },
    {
      id: "has_media",
      prompt: "Do you have a photo or video?",
      fieldType: "boolean",
      helpText: "You can attach media on the next step when available.",
    },
  ],
  active_threat: [
    { id: "danger_ongoing", prompt: "Is the danger happening right now?", fieldType: "boolean", required: true },
    { id: "threat_location", prompt: "Where is the threat?", fieldType: "text", required: true },
    { id: "threat_description", prompt: "Describe what you see or heard", fieldType: "textarea", required: true },
    { id: "people_in_danger", prompt: "Is anyone injured or trapped?", fieldType: "boolean" },
  ],
  bullying: [
    { id: "people_involved", prompt: "Who is involved?", fieldType: "textarea", required: true },
    { id: "incident_location", prompt: "Where did this happen?", fieldType: "text", required: true },
    {
      id: "frequency",
      prompt: "How often has this happened?",
      fieldType: "select",
      options: ["First time", "A few times", "Ongoing / repeated", "Unknown"],
      required: true,
    },
    { id: "what_happened", prompt: "Describe what happened", fieldType: "textarea", required: true },
    { id: "witnesses", prompt: "Any witnesses?", fieldType: "text" },
    {
      id: "has_screenshots",
      prompt: "Do you have screenshots or other media?",
      fieldType: "boolean",
    },
  ],
  cyberbullying: [
    { id: "platform", prompt: "Where did this occur online?", fieldType: "text", required: true },
    { id: "people_involved", prompt: "Who is involved?", fieldType: "textarea", required: true },
    { id: "what_happened", prompt: "Describe the messages or posts", fieldType: "textarea", required: true },
    { id: "has_screenshots", prompt: "Do you have screenshots?", fieldType: "boolean", required: true },
  ],
  self_harm: [
    {
      id: "immediate_danger",
      prompt: "Is the student in immediate danger right now?",
      fieldType: "boolean",
      required: true,
    },
    { id: "student_identity", prompt: "Who is the student? (name/grade if known)", fieldType: "text", required: true },
    { id: "what_observed", prompt: "What did you see, hear, or read?", fieldType: "textarea", required: true },
    { id: "student_location", prompt: "Where is the student now?", fieldType: "text" },
  ],
  custody_pickup: [
    { id: "student_identity", prompt: "Which student?", fieldType: "text", required: true },
    { id: "adult_description", prompt: "Describe the adult attempting pickup", fieldType: "textarea", required: true },
    { id: "restriction_known", prompt: "Is there a known custody restriction?", fieldType: "boolean" },
    { id: "current_location", prompt: "Where is this happening?", fieldType: "text", required: true },
  ],
  threat_of_violence: [
    { id: "threat_medium", prompt: "How was the threat made?", fieldType: "select", options: ["Verbal", "Written", "Online / social media", "Other", "Unknown"], required: true },
    { id: "target", prompt: "Who or what was threatened?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "Describe the threat", fieldType: "textarea", required: true },
    { id: "happening_now", prompt: "Is there an immediate risk right now?", fieldType: "boolean", required: true },
  ],
  missing_student: [
    { id: "student_identity", prompt: "Which student?", fieldType: "text", required: true },
    { id: "last_seen", prompt: "Where / when were they last seen?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "What happened?", fieldType: "textarea", required: true },
  ],
  medical_emergency: [
    { id: "person_status", prompt: "Is the person conscious and breathing?", fieldType: "select", options: ["Yes", "No", "Unknown"], required: true },
    { id: "location", prompt: "Where is the person?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "Describe the medical emergency", fieldType: "textarea", required: true },
    { id: "ems_called", prompt: "Has 911 / EMS already been called?", fieldType: "boolean" },
  ],
  bomb_threat: [
    { id: "threat_source", prompt: "How was this reported?", fieldType: "select", options: ["Phone", "Written / note", "Package / item found", "Online", "Other"], required: true },
    { id: "location", prompt: "Where is the package or threatened area?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "Describe what you know", fieldType: "textarea", required: true },
  ],
  abuse_neglect: [
    { id: "student_identity", prompt: "Which student? (name/grade if known)", fieldType: "text", required: true },
    { id: "what_happened", prompt: "What concerns you?", fieldType: "textarea", required: true },
    { id: "immediate_danger", prompt: "Is the student in immediate danger?", fieldType: "boolean", required: true },
  ],
};

const GROUP_DEFAULT_QUESTIONS: Record<K12IncidentGroupId, readonly K12FollowUpQuestion[]> = {
  emergency_threats: [
    { id: "happening_now", prompt: "Is this happening right now?", fieldType: "boolean", required: true },
    { id: "location", prompt: "Where is this occurring?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "Describe what you see or heard", fieldType: "textarea", required: true },
  ],
  student_safety_wellness: [
    { id: "student_identity", prompt: "Which student? (name/grade if known)", fieldType: "text", required: true },
    { id: "what_happened", prompt: "What are you concerned about?", fieldType: "textarea", required: true },
    { id: "student_location", prompt: "Where is the student now?", fieldType: "text" },
  ],
  bullying_misconduct: [
    { id: "people_involved", prompt: "Who is involved?", fieldType: "textarea", required: true },
    { id: "location", prompt: "Where did this happen?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "Describe what happened", fieldType: "textarea", required: true },
  ],
  drugs_prohibited: [
    { id: "what_observed", prompt: "What did you observe?", fieldType: "textarea", required: true },
    { id: "location", prompt: "Where?", fieldType: "text", required: true },
    { id: "people_involved", prompt: "Who is involved? (if known)", fieldType: "text" },
  ],
  medical_health: [
    { id: "person_status", prompt: "Is the person conscious and breathing?", fieldType: "select", options: ["Yes", "No", "Unknown"], required: true },
    { id: "location", prompt: "Where is the person?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "Describe the medical concern", fieldType: "textarea", required: true },
  ],
  security_suspicious: [
    { id: "location", prompt: "Where is this occurring?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "Describe the person or activity", fieldType: "textarea", required: true },
    { id: "happening_now", prompt: "Is this still ongoing?", fieldType: "boolean" },
  ],
  transport_facilities: [
    { id: "location", prompt: "Where is the issue?", fieldType: "text", required: true },
    { id: "what_happened", prompt: "Describe the safety concern", fieldType: "textarea", required: true },
  ],
  other_concerns: [
    { id: "what_happened", prompt: "Describe your concern", fieldType: "textarea", required: true },
    { id: "location", prompt: "Where?", fieldType: "text" },
  ],
};

export function getK12GroupForType(typeValue: string): K12IncidentGroupId {
  return K12_TYPE_TO_GROUP[typeValue] ?? "other_concerns";
}

export function getK12TypesInGroup(
  types: readonly CampusIncidentTypeConfig[],
  groupId: K12IncidentGroupId,
): CampusIncidentTypeConfig[] {
  return types.filter((t) => getK12GroupForType(t.value) === groupId);
}

export function getK12FollowUpQuestions(typeValue: string): readonly K12FollowUpQuestion[] {
  const specific = K12_FOLLOW_UP_BY_TYPE[typeValue];
  if (specific?.length) return specific;
  return GROUP_DEFAULT_QUESTIONS[getK12GroupForType(typeValue)] ?? GROUP_DEFAULT_QUESTIONS.other_concerns;
}

/** Format follow-up answers for prepend into the free-text report message. */
export function formatK12FollowUpAnswers(
  answers: Record<string, string | boolean | undefined>,
  questions: readonly K12FollowUpQuestion[],
): string {
  const lines: string[] = [];
  for (const q of questions) {
    const raw = answers[q.id];
    if (raw === undefined || raw === "") continue;
    const value =
      typeof raw === "boolean" ? (raw ? "Yes" : "No") : String(raw).trim();
    if (!value) continue;
    lines.push(`${q.prompt}: ${value}`);
  }
  return lines.join("\n");
}

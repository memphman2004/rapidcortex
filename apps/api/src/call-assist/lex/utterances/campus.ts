/** Training utterances for campus Lex intents (also declared in stack-lex.yaml). */
export const UTTERANCES_CAMPUS = {
  WellnessCheck: [
    "can someone check on my friend",
    "wellness check",
    "I'm worried about a student",
    "someone is not responding to messages",
    "welfare check",
  ],
  MedicalRequest: ["someone is hurt", "medical help needed", "someone passed out", "I need medical assistance"],
  FacilitiesIssue: [
    "something is broken",
    "maintenance issue",
    "the elevator is stuck",
    "there is a leak",
    "facilities problem",
  ],
} as const;

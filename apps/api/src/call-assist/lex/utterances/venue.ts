/** Training utterances for venue Lex intents (also declared in stack-lex.yaml). */
export const UTTERANCES_VENUE = {
  MedicalAssistance: [
    "someone needs medical help",
    "person collapsed",
    "medical emergency at section",
    "unresponsive person",
  ],
  SecurityIncident: ["fight in section", "someone is being aggressive", "security needed", "threatening behavior"],
  LostPerson: ["I lost my child", "missing person", "can't find my kid", "lost child in section"],
} as const;

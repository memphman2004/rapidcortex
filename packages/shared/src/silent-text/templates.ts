/** Built-in dispatcher quick prompts (extend per agency in a future config service). */
export type SilentTextPromptTemplate = {
  id: string;
  label: string;
  /** Message text sent to the caller. */
  text: string;
};

export const DEFAULT_SILENT_TEXT_PROMPT_TEMPLATES: SilentTextPromptTemplate[] = [
  { id: "yes_police", label: "YES if police now", text: "Reply YES if you need police sent to you right now." },
  { id: "person_there", label: "1 = person still there", text: "Reply 1 if someone who worries you is still there. Reply 2 if they left." },
  { id: "hidden", label: "2 = you are hidden", text: "Reply 1 if you are hidden and safe for the moment. Reply 2 if you cannot hide." },
  { id: "injured", label: "3 = injured", text: "Reply 1 if you are hurt or injured. Reply 2 if you are not injured." },
  { id: "address", label: "Location (if safe)", text: "If it is safe to type, send your address or what you see outside (street, business names)." },
  { id: "we_are_here", label: "We are with you", text: "We are here with you. Short answers are OK. Tell us only what you feel safe sharing." },
  { id: "stay_quiet", label: "Stay quiet reminder", text: "You do not need to speak. Keep your phone silent if that is safer." },
];

/** Caller one-tap chips — sent as normal text. */
export const DEFAULT_CALLER_QUICK_REPLIES: { id: string; label: string; text: string }[] = [
  { id: "yes", label: "Yes", text: "Yes" },
  { id: "no", label: "No", text: "No" },
  { id: "cannot_talk", label: "Cannot talk", text: "Cannot talk" },
  { id: "someone_here", label: "Someone is here", text: "Someone is here" },
  { id: "help_now", label: "Send help now", text: "Send help now" },
  { id: "hiding", label: "I am hiding", text: "I am hiding" },
  { id: "police", label: "Need police", text: "Need police" },
  { id: "ambulance", label: "Need ambulance", text: "Need ambulance" },
  { id: "fire", label: "Need fire", text: "Need fire" },
];

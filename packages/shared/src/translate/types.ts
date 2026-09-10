/**
 * RC Translate — bidirectional field translation session types.
 * Addons: `rc.translate` (LE), `rc.translate.venue`, `rc.translate.campus`, `rc.translate.hospital`.
 */

export const TRANSLATE_SESSION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "CLOSED",
  "EXPIRED",
] as const;
export type TranslateSessionStatus = (typeof TRANSLATE_SESSION_STATUSES)[number];

export const TRANSLATE_SESSION_CLOSED_STATUSES: readonly TranslateSessionStatus[] = [
  "CLOSED",
  "EXPIRED",
];

export const TRANSLATE_SPEAKERS = ["officer", "subject"] as const;
export type TranslateSpeaker = (typeof TRANSLATE_SPEAKERS)[number];

export const TRANSLATE_CAD_WRITEBACK_STATUSES = [
  "NONE",
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "AUTO",
] as const;
export type TranslateCadWritebackStatus = (typeof TRANSLATE_CAD_WRITEBACK_STATUSES)[number];

export const TRANSLATE_VERTICALS = [
  "law_enforcement",
  "venue",
  "campus",
  "hospital",
] as const;
export type TranslateVertical = (typeof TRANSLATE_VERTICALS)[number];

export const TRANSLATE_SPEAKER_LABELS: Record<
  TranslateVertical,
  { primary: string; secondary: string }
> = {
  law_enforcement: { primary: "Officer", secondary: "Subject" },
  venue: { primary: "Staff", secondary: "Guest" },
  campus: { primary: "Staff", secondary: "Individual" },
  hospital: { primary: "Provider", secondary: "Patient" },
};

export const TRANSLATE_ADDON_BY_VERTICAL: Record<TranslateVertical, string> = {
  law_enforcement: "rc.translate",
  venue: "rc.translate.venue",
  campus: "rc.translate.campus",
  hospital: "rc.translate.hospital",
};

/** Voice-pipeline language row. Named apart from the call-language registry `SupportedLanguage`. */
export interface TranslateSupportedLanguage {
  code: string;
  label: string;
  transcribeCode: string;
  translateCode: string;
  pollyVoiceId: string;
  pollyEngine: "neural" | "standard";
  rtl: boolean;
}

export const SUPPORTED_LANGUAGES: readonly TranslateSupportedLanguage[] = [
  { code: "es", label: "Spanish", transcribeCode: "es-US", translateCode: "es", pollyVoiceId: "Lupe", pollyEngine: "neural", rtl: false },
  { code: "zh-CN", label: "Mandarin (Chinese)", transcribeCode: "zh-CN", translateCode: "zh", pollyVoiceId: "Zhiyu", pollyEngine: "neural", rtl: false },
  { code: "zh-TW", label: "Cantonese", transcribeCode: "zh-TW", translateCode: "zh-TW", pollyVoiceId: "Hiujin", pollyEngine: "neural", rtl: false },
  { code: "vi", label: "Vietnamese", transcribeCode: "vi-VN", translateCode: "vi", pollyVoiceId: "Linh", pollyEngine: "neural", rtl: false },
  { code: "ko", label: "Korean", transcribeCode: "ko-KR", translateCode: "ko", pollyVoiceId: "Seoyeon", pollyEngine: "neural", rtl: false },
  { code: "ar", label: "Arabic", transcribeCode: "ar-SA", translateCode: "ar", pollyVoiceId: "Hala", pollyEngine: "neural", rtl: true },
  { code: "tl", label: "Tagalog", transcribeCode: "tl-PH", translateCode: "tl", pollyVoiceId: "Olivia", pollyEngine: "neural", rtl: false },
  { code: "ru", label: "Russian", transcribeCode: "ru-RU", translateCode: "ru", pollyVoiceId: "Tatyana", pollyEngine: "standard", rtl: false },
  { code: "fr", label: "French", transcribeCode: "fr-FR", translateCode: "fr", pollyVoiceId: "Lea", pollyEngine: "neural", rtl: false },
  { code: "de", label: "German", transcribeCode: "de-DE", translateCode: "de", pollyVoiceId: "Vicki", pollyEngine: "neural", rtl: false },
  { code: "pt", label: "Portuguese", transcribeCode: "pt-BR", translateCode: "pt", pollyVoiceId: "Camila", pollyEngine: "neural", rtl: false },
  { code: "hi", label: "Hindi", transcribeCode: "hi-IN", translateCode: "hi", pollyVoiceId: "Kajal", pollyEngine: "neural", rtl: false },
  { code: "so", label: "Somali", transcribeCode: "so-SO", translateCode: "so", pollyVoiceId: "Olivia", pollyEngine: "neural", rtl: false },
  { code: "am", label: "Amharic", transcribeCode: "am-ET", translateCode: "am", pollyVoiceId: "Olivia", pollyEngine: "neural", rtl: false },
  { code: "ht", label: "Haitian Creole", transcribeCode: "en-US", translateCode: "ht", pollyVoiceId: "Olivia", pollyEngine: "neural", rtl: false },
] as const;

export const OFFICER_LANGUAGE: TranslateSupportedLanguage = {
  code: "en",
  label: "English",
  transcribeCode: "en-US",
  translateCode: "en",
  pollyVoiceId: "Matthew",
  pollyEngine: "neural",
  rtl: false,
};

export interface TranslateVenueContext {
  venueCode: string;
  venueName?: string;
  venueIncidentId?: string;
  sectionCode?: string;
  sectionLabel?: string;
}

export interface TranslateCampusContext {
  campusCode: string;
  campusName?: string;
  campusIncidentId?: string;
  buildingCode?: string;
  buildingLabel?: string;
}

export interface TranslateHospitalContext {
  hospitalId: string;
  hospitalName?: string;
  patientEncounterId?: string;
  departmentCode?: string;
  departmentLabel?: string;
}

export interface TranslateSession {
  sessionId: string;
  agencyId: string;
  incidentId?: string;
  officerId: string;
  officerName?: string;
  officerUnit?: string;
  officerBadge?: string;
  primaryLanguage: string;
  subjectLanguage: string;
  subjectLanguageDetected: boolean;
  status: TranslateSessionStatus;
  startedAt: string;
  endedAt?: string;
  location?: { latitude: number; longitude: number };
  segmentCount: number;
  cadWritebackStatus: TranslateCadWritebackStatus;
  cadNoteId?: string;
  monitorUserIds: string[];
  dispatchInitiatedByUserId?: string;
  sessionUrl: string;
  sessionUrlExpiresAt?: string;
  sessionSummary?: string;
  vertical: TranslateVertical;
  venueContext?: TranslateVenueContext;
  campusContext?: TranslateCampusContext;
  hospitalContext?: TranslateHospitalContext;
  createdAt: string;
  updatedAt: string;
}

export interface TranslateSegment {
  segmentId: string;
  sessionId: string;
  agencyId: string;
  speaker: TranslateSpeaker;
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  confidenceScore: number;
  audioS3Key?: string;
  audioPresignedUrl?: string;
  durationMs: number;
  timestamp: string;
  isFinal: boolean;
  phraseId?: string;
}

export type TranslateWsRole = "officer" | "monitor";

export interface TranslateWsAudioChunk {
  type: "audio_chunk";
  speaker: TranslateSpeaker;
  audioBase64: string;
  sampleRate: number;
  isFinal: boolean;
}

export interface TranslateWsPhraseRequest {
  type: "phrase";
  speaker: TranslateSpeaker;
  text: string;
  phraseId?: string;
}

export interface TranslateWsHeartbeat {
  type: "ping";
}

export type TranslateWsInbound =
  | TranslateWsAudioChunk
  | TranslateWsPhraseRequest
  | TranslateWsHeartbeat;

export interface TranslateWsTranscriptEvent {
  type: "transcript_partial" | "transcript_final";
  segmentId: string;
  speaker: TranslateSpeaker;
  originalText: string;
  originalLanguage: string;
  confidence: number;
}

export interface TranslateWsTranslationEvent {
  type: "translation_ready";
  segmentId: string;
  speaker: TranslateSpeaker;
  translatedText: string;
  targetLanguage: string;
}

export interface TranslateWsAudioEvent {
  type: "audio_ready";
  segmentId: string;
  speaker: TranslateSpeaker;
  audioPresignedUrl: string;
  durationMs: number;
}

export interface TranslateWsLanguageDetectedEvent {
  type: "language_detected";
  languageCode: string;
  languageLabel: string;
  confidence: number;
}

export interface TranslateWsSessionStateEvent {
  type: "session_state";
  status: TranslateSessionStatus;
  segmentCount: number;
}

export interface TranslateWsMonitorEvent {
  type: "monitor_joined" | "monitor_left";
  monitorUserName: string;
}

export interface TranslateWsErrorEvent {
  type: "error";
  code:
    | "LOW_CONFIDENCE"
    | "TRANSCRIBE_ERROR"
    | "TRANSLATE_ERROR"
    | "POLLY_ERROR"
    | "SESSION_CLOSED"
    | "MIC_ERROR";
  message: string;
}

export interface TranslateWsPong {
  type: "pong";
}

export type TranslateWsOutbound =
  | TranslateWsTranscriptEvent
  | TranslateWsTranslationEvent
  | TranslateWsAudioEvent
  | TranslateWsLanguageDetectedEvent
  | TranslateWsSessionStateEvent
  | TranslateWsMonitorEvent
  | TranslateWsErrorEvent
  | TranslateWsPong;

export interface TranslateSessionCreateRequest {
  incidentId?: string;
  subjectLanguage?: string;
  location?: { latitude: number; longitude: number };
  vertical?: TranslateVertical;
  venueContext?: TranslateVenueContext;
  campusContext?: TranslateCampusContext;
  hospitalContext?: TranslateHospitalContext;
}

export interface TranslateSessionCreateResponse {
  session: TranslateSession;
  wsEndpoint: string;
}

export interface TranslateLinkRequest {
  incidentId?: string;
  officerPhone?: string;
  officerUserId?: string;
  subjectLanguage?: string;
  vertical?: TranslateVertical;
  venueContext?: TranslateVenueContext;
  campusContext?: TranslateCampusContext;
  hospitalContext?: TranslateHospitalContext;
}

export interface TranslateLinkResponse {
  sessionId: string;
  sessionUrl: string;
  smsDelivered: boolean;
  notificationDelivered: boolean;
  expiresAt: string;
}

export interface TranslateSessionCloseRequest {
  cadWriteback?: boolean;
  writebackNote?: boolean;
  notes?: string;
}

export interface TranslateSessionCloseResponse {
  session: TranslateSession;
  summaryGenerated: boolean;
  cadWritebackQueued: boolean;
  writebackQueued: boolean;
}

export interface TranslateCadWritebackPayload {
  sessionId: string;
  incidentId: string;
  officerName: string;
  officerUnit: string;
  officerBadge?: string;
  subjectLanguage: string;
  startedAt: string;
  duration: string;
  segmentCount: number;
  summary: string;
  fullTranscript: string;
}

export interface TranslatePhrase {
  id: string;
  label: string;
  text: string;
  category: string;
}

export const VENUE_PHRASES: TranslatePhrase[] = [
  { id: "v1", label: "Your seat is in...", category: "directions", text: "Your seat is in section {section}. Please follow me and I will take you there." },
  { id: "v2", label: "Medical help coming", category: "medical", text: "Medical help is on the way. Please stay calm and do not move." },
  { id: "v3", label: "Please come with me", category: "general", text: "Please come with me. I am here to help you." },
  { id: "v4", label: "Lost child located", category: "safety", text: "We have found a child who may be lost. Are you looking for a child?" },
  { id: "v5", label: "You must leave the venue", category: "ejection", text: "I need you to leave the venue now. Please come with me to the exit." },
  { id: "v6", label: "Can I see your ticket?", category: "ticketing", text: "May I see your ticket or wristband please?" },
  { id: "v7", label: "Restrooms location", category: "directions", text: "The restrooms are located straight ahead and to the right." },
  { id: "v8", label: "Emergency evacuation", category: "safety", text: "We need to evacuate the building now. Please follow the staff to the nearest exit. Do not run." },
  { id: "v9", label: "Are you injured?", category: "medical", text: "Are you injured or do you need medical attention?" },
  { id: "v10", label: "Lost and found", category: "general", text: "Have you lost something? Our lost and found is located at the main gate." },
];

export const CAMPUS_PHRASES: TranslatePhrase[] = [
  { id: "c1", label: "Campus security here to help", category: "intro", text: "I am campus security and I am here to help you. You are safe." },
  { id: "c2", label: "Are you a student here?", category: "general", text: "Are you a student or staff member at this university?" },
  { id: "c3", label: "Do you need medical help?", category: "medical", text: "Do you need medical attention? I can call for help immediately." },
  { id: "c4", label: "Please go to this building", category: "directions", text: "Please go to this building. It is safe and staff will help you there." },
  { id: "c5", label: "Emergency — follow me", category: "safety", text: "This is an emergency. Please follow me immediately to a safe location." },
  { id: "c6", label: "Can I see your campus ID?", category: "access", text: "May I see your campus identification card please?" },
  { id: "c7", label: "Counseling services available", category: "support", text: "Counseling and mental health services are available to you at no cost. Would you like to speak with someone?" },
  { id: "c8", label: "Evacuation in progress", category: "safety", text: "There is an emergency evacuation in progress. Please follow the signs and exit the building now." },
  { id: "c9", label: "Your family has been notified", category: "support", text: "Your family or emergency contact has been notified. They are on their way." },
  { id: "c10", label: "You are not in trouble", category: "support", text: "You are not in trouble. I am here to make sure you are safe and to help you." },
];

export const HOSPITAL_PHRASES: TranslatePhrase[] = [
  { id: "h1", label: "I'm here to help you", category: "intro", text: "My name is {name} and I am here to take care of you. You are safe." },
  { id: "h2", label: "Where does it hurt?", category: "symptoms", text: "Can you point to where you are feeling pain or discomfort?" },
  { id: "h3", label: "Rate your pain 1 to 10", category: "symptoms", text: "On a scale of 1 to 10, with 10 being the worst pain you have ever felt, how would you rate your pain right now?" },
  { id: "h4", label: "How long have you had symptoms?", category: "symptoms", text: "How long have you been experiencing these symptoms? When did this start?" },
  { id: "h5", label: "Do you have any allergies?", category: "medical", text: "Are you allergic to any medications, foods, or other substances?" },
  { id: "h6", label: "I need to examine you", category: "procedure", text: "I need to examine you now. Is that okay? Please let me know if anything is uncomfortable." },
  { id: "h7", label: "We need to take blood", category: "procedure", text: "I need to take a small blood sample. You will feel a small pinch. Are you ready?" },
  { id: "h8", label: "The doctor will be with you", category: "wait", text: "The doctor will be with you very soon. Please stay here and rest." },
  { id: "h9", label: "You can go home today", category: "discharge", text: "You are ready to go home today. We will give you instructions to take with you." },
  { id: "h10", label: "Do you have someone to help?", category: "support", text: "Do you have a family member or friend who can help take care of you at home?" },
  { id: "h11", label: "Take this medication", category: "treatment", text: "Please take this medication as directed. Do not take more than prescribed." },
  { id: "h12", label: "Are you pregnant?", category: "medical", text: "Are you currently pregnant or is there any chance you could be pregnant?" },
];

export const PHRASES_BY_VERTICAL: Partial<Record<TranslateVertical, TranslatePhrase[]>> = {
  venue: VENUE_PHRASES,
  campus: CAMPUS_PHRASES,
  hospital: HOSPITAL_PHRASES,
};

export function findSupportedLanguage(code: string): TranslateSupportedLanguage | undefined {
  if (code === "en" || code === "en-US") return OFFICER_LANGUAGE;
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function phrasesForVertical(vertical: TranslateVertical): TranslatePhrase[] {
  return PHRASES_BY_VERTICAL[vertical] ?? [];
}

/** Fill `{section}` / `{name}` tokens in phrase packs. Unknown keys become empty strings. */
export function interpolateTranslatePhrase(
  text: string,
  vars: Record<string, string | undefined>,
): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => vars[key] ?? "");
}

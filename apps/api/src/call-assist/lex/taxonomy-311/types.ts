/**
 * Call Assist — 311 Non-Emergency Call Handling
 * Lex V2 Intent Schema — Type Definitions
 *
 * Architectural pattern: Category-level intents with SubIssueType slot
 * for disambiguation rather than 150+ flat intents.
 * Lambda dialog code hook handles all branching and escalation.
 */

// ─── Department Routing ─────────────────────────────────────────────────────

export type CityDepartment =
  | 'PUBLIC_WORKS'
  | 'PUBLIC_WORKS_ELECTRICAL'
  | 'SANITATION'
  | 'WATER_SEWER_AUTHORITY'
  | 'CODE_ENFORCEMENT'
  | 'PARKING_ENFORCEMENT'
  | 'ANIMAL_CONTROL'
  | 'URBAN_FORESTRY'
  | 'PARKS_RECREATION'
  | 'HOUSING_COMMUNITY_DEV'
  | 'ENVIRONMENTAL_QUALITY'
  | 'POLICE_NON_EMERGENCY'
  | 'FIRE_MARSHAL_NON_EMERGENCY'
  | 'TRANSIT_AUTHORITY'
  | 'CITY_CLERK'
  | 'SOCIAL_SERVICES'
  | 'THREE11_OPERATIONS'
  | 'ESCALATE_911'; // reserved — never fulfilled as 311 SR

// ─── Service Categories (maps 1:1 to top-level intents) ─────────────────────

export type ServiceCategory =
  | 'ROADS_INFRASTRUCTURE'
  | 'STREET_LIGHTING'
  | 'TRAFFIC_SIGNS_MARKINGS'
  | 'SANITATION_WASTE'
  | 'WATER_SEWER_DRAINAGE'
  | 'NOISE_COMPLAINT'
  | 'ABANDONED_ILLEGAL_VEHICLES'
  | 'GRAFFITI_VANDALISM'
  | 'ANIMALS_PESTS'
  | 'TREES_VEGETATION'
  | 'PARKS_PUBLIC_SPACES'
  | 'BUILDINGS_HOUSING'
  | 'HOMELESS_SOCIAL_SERVICES'
  | 'ENVIRONMENTAL_HEALTH'
  | 'LAW_ENFORCEMENT_NON_EMERGENCY'
  | 'FIRE_EMS_NON_EMERGENCY'
  | 'TRANSIT_TRANSPORTATION'
  | 'GOVERNMENT_INFORMATION'
  | 'SPECIAL_EVENTS_PERMITS'
  | 'SERVICE_REQUEST_STATUS';

export type PriorityLevel =
  | 'INFO_ONLY'    // No SR created — information provided
  | 'STANDARD'     // Normal queue
  | 'ELEVATED'     // Same-day response expected
  | 'ESCALATE_911'; // Route to 911 immediately

// ─── Slot Type Definitions ────────────────────────────────────────────────────

export interface SlotTypeValue {
  value: string;
  synonyms?: string[];
}

export interface CustomSlotTypeDefinition {
  name: string;
  description: string;
  values: SlotTypeValue[];
  resolutionStrategy: 'ORIGINAL_VALUE' | 'TOP_RESOLUTION';
}

// ─── Intent Slot Definitions ──────────────────────────────────────────────────

export interface SlotDefinition {
  name: string;
  description: string;
  /** AMAZON.FreeFormInput, AMAZON.PhoneNumber, AMAZON.FirstName, or custom type name */
  slotTypeName: string;
  isRequired: boolean;
  elicitationPrompt: string;
  clarificationPrompts: string[];
  /** Priority order for elicitation — lower = asked first */
  priority: number;
}

// ─── Intent Definitions ────────────────────────────────────────────────────────

export interface IntentDefinition {
  name: string;
  description: string;
  category: ServiceCategory;
  primaryDepartment: CityDepartment;
  /** Used when routing differs based on sub-issue type */
  conditionalDepartmentRouting?: Record<string, CityDepartment>;
  priorityLevel: PriorityLevel;
  sampleUtterances: string[];
  slots: SlotDefinition[];
  confirmationPrompt: string;
  fulfillmentMessage: string;
  /**
   * Keywords in the caller's transcript that trigger immediate
   * 911 escalation. Checked BEFORE any slot elicitation.
   */
  escalationKeywords?: string[];
  /**
   * Whether this intent requires a disambiguation step beyond
   * simple slot elicitation — handled in dialog Lambda.
   */
  requiresDisambiguation?: boolean;
}

// ─── Lambda Event/Response Types ──────────────────────────────────────────────

export interface LexSlotValue {
  interpretedValue: string;
  originalValue: string;
  resolvedValues?: string[];
}

export interface LexSlot {
  value?: LexSlotValue;
  shape?: 'Scalar' | 'List';
  values?: LexSlot[];
}

export interface LexIntent {
  name: string;
  confirmationState: 'Confirmed' | 'Denied' | 'None';
  state: 'InProgress' | 'ReadyForFulfillment' | 'Fulfilled' | 'Failed' | 'Waiting';
  slots: Record<string, LexSlot | null>;
}

export interface LexSessionState {
  sessionAttributes?: Record<string, string>;
  activeContexts?: Array<{
    name: string;
    contextAttributes: Record<string, string>;
    timeToLive: { turns: number; timeToLiveInSeconds: number };
  }>;
  runtimeHints?: {
    slotHints: Record<string, Record<string, { runtimeHintValues: Array<{ phrase: string }> }>>;
  };
  dialogAction: {
    type: 'ElicitIntent' | 'ElicitSlot' | 'ConfirmIntent' | 'Delegate' | 'Close';
    slotToElicit?: string;
    suppressNextMessage?: boolean;
  };
  intent: LexIntent;
  originatingRequestId: string;
}

export interface LexV2DialogEvent {
  messageVersion: string;
  invocationSource: 'DialogCodeHook' | 'FulfillmentCodeHook';
  inputMode: 'Speech' | 'Text' | 'DTMF';
  responseContentType: string;
  sessionId: string;
  inputTranscript: string;
  bot: { id: string; name: string; aliasId: string; localeId: string; version: string };
  interpretations: Array<{
    intent: LexIntent;
    nluConfidence?: { score: number };
  }>;
  sessionState: LexSessionState;
  requestAttributes?: Record<string, string>;
  transcriptions?: Array<{
    transcription: string;
    transcriptionConfidence?: { score: number };
    resolvedContext?: { intent: string };
  }>;
}

export interface LexMessage {
  contentType: 'PlainText' | 'SSML' | 'CustomPayload';
  content: string;
}

export interface LexV2DialogResponse {
  sessionState: {
    sessionAttributes?: Record<string, string>;
    dialogAction: {
      type: 'ElicitIntent' | 'ElicitSlot' | 'ConfirmIntent' | 'Delegate' | 'Close';
      slotToElicit?: string;
    };
    intent: {
      name: string;
      slots: Record<string, LexSlot | null>;
      state: LexIntent['state'];
    };
    runtimeHints?: LexSessionState['runtimeHints'];
  };
  messages?: LexMessage[];
  requestAttributes?: Record<string, string>;
}

// ─── Service Request (DynamoDB record) ───────────────────────────────────────

export interface ServiceRequest {
  srId: string;                     // SR-YYYYMMDD-XXXXXX
  sessionId: string;
  createdAt: string;                // ISO 8601
  intentName: string;
  category: ServiceCategory;
  subIssueType: string;
  department: CityDepartment;
  priorityLevel: PriorityLevel;
  serviceAddress: string;
  issueDescription: string;
  isOngoing?: boolean;
  callerName?: string;
  callbackNumber?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  ttl?: number;                     // DynamoDB TTL — 2 years from creation
}

// ─── Builder Result ──────────────────────────────────────────────────────────

export interface BotBuildResult {
  botId: string;
  botVersion: string;
  localeId: string;
  intentCount: number;
  slotTypeCount: number;
  intentsCreated: string[];
  intentsUpdated: string[];
  slotTypesCreated: string[];
  slotTypesUpdated: string[];
  errors: Array<{ resource: string; error: string }>;
  durationMs: number;
}

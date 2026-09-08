/** Amazon Lex V2 dialog/fulfillment hook event and response types. */

export interface LexV2Event {
  messageVersion?: string;
  invocationSource: "DialogCodeHook" | "FulfillmentCodeHook";
  inputMode?: "DTMF" | "Speech" | "Text";
  responseContentType?: string;
  sessionId: string;
  inputTranscript: string;
  bot?: {
    id: string;
    name: string;
    aliasId: string;
    aliasName: string;
    localeId: string;
    version: string;
  };
  interpretations: LexInterpretation[];
  requestAttributes?: Record<string, string>;
  sessionState: LexSessionState;
  transcriptions?: LexTranscription[];
}

export interface LexInterpretation {
  intent: LexIntent;
  nluConfidence?: number;
  sentimentResponse?: {
    sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
    sentimentScore: { positive: number; negative: number; neutral: number; mixed: number };
  };
}

export interface LexSessionState {
  activeContexts?: unknown[];
  sessionAttributes: Record<string, string>;
  runtimeHints?: unknown;
  dialogAction?: LexDialogAction;
  intent: LexIntent;
  originatingRequestId?: string;
}

export interface LexIntent {
  name: string;
  slots: Record<string, LexSlotValue | null>;
  state?: "InProgress" | "ReadyForFulfillment" | "Fulfilled" | "Failed" | "Waiting";
  confirmationState?: "None" | "Confirmed" | "Denied";
}

export interface LexSlotValue {
  value?: {
    originalValue?: string;
    interpretedValue?: string;
    resolvedValues?: string[];
  };
  shape?: "Scalar" | "List";
  values?: LexSlotValue[];
}

export type LexDialogAction =
  | { type: "ElicitSlot"; slotToElicit: string }
  | { type: "ElicitIntent" }
  | { type: "Delegate" }
  | { type: "ConfirmIntent" }
  | { type: "Close"; fulfillmentState: "Fulfilled" | "Failed" };

export interface LexTranscription {
  transcription: string;
  transcriptionConfidence: number;
}

export interface LexMessage {
  contentType: "PlainText" | "SSML" | "CustomPayload";
  content: string;
}

export interface LexV2Response {
  sessionState: {
    sessionAttributes?: Record<string, string>;
    dialogAction: LexDialogAction;
    intent: {
      name: string;
      slots?: Record<string, LexSlotValue | null>;
      state?: string;
      confirmationState?: string;
    };
  };
  messages?: LexMessage[];
  requestAttributes?: Record<string, string>;
}

/**
 * Connect contact-flow hook for Nexiq voice-engine selection.
 * Nova 2 Sonic is used when the agency flag is on.
 * Otherwise the call stays on Lex, which still opens with the Nexiq greeting.
 * Fallback to Lex is always returned.
 */
import { decideCallAssistVoiceEngine, type VoiceEngineDecision } from "rapid-cortex-shared";

export type NovaSonicSessionInitEvent = {
  Details?: {
    Parameters?: { AgencyId?: string };
    ContactId?: string;
    ContactData?: { ContactId?: string };
  };
};

export function novaSonicSessionInitDecision(
  event: NovaSonicSessionInitEvent,
  agency?: { novaSonicEnabled?: boolean | null; systemPromptAppend?: string | null; novaSonicVoiceId?: string | null } | null,
): VoiceEngineDecision {
  const agencyId = event.Details?.Parameters?.AgencyId;
  const sessionId = event.Details?.ContactData?.ContactId ?? event.Details?.ContactId;
  return decideCallAssistVoiceEngine({
    agencyId,
    sessionId,
    novaSonicEnabled: agency?.novaSonicEnabled === true,
    agencyPrompt: agency?.systemPromptAppend,
    voiceId: agency?.novaSonicVoiceId,
  });
}

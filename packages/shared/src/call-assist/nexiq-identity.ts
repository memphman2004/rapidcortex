/**
 * Nexiq identity. Spoken on every non-emergency call, on Nova 2 Sonic and on Lex/Polly.
 * Agency text may follow this block. It cannot replace it.
 */

export const NEXIQ_PRODUCT_NAME = "Nexiq";

/** Polly IPA. Two syllables, stress on the first: NEX-ik. */
export const NEXIQ_PRONUNCIATION_IPA = "ˈnɛksɪk";

export const NEXIQ_OPENING_GREETING = "Thank you for calling. I'm Nexiq, an AI assistant.";

export const NEXIQ_NAME_REPLY = "I'm Nexiq, your AI assistant for city services.";

export const NEXIQ_NAME_REPLY_ES = "Soy Nexiq, su asistente de IA para servicios municipales.";

export const NEXIQ_NAME_REPLY_PT = "Sou o Nexiq, seu assistente de IA para serviços municipais.";

export const NEXIQ_IDENTITY_MARKER = "ASSISTANT IDENTITY";

export const NEXIQ_IDENTITY_BLOCK = `${NEXIQ_IDENTITY_MARKER}

Your name is Nexiq. Pronounced "NEX-ik" (Nex-ic): two syllables, stress on the first.
Never say "Nex-I-Q". Never spell the letters. Never say it as three syllables.

INTRODUCTION RULE — CRITICAL
The opening line for this product is: "${NEXIQ_OPENING_GREETING}"
That line is spoken at most once per call — by telephony, or by you on the first turn only when greetingDelivered is false.
Do NOT re-greet. Do NOT introduce yourself again. Do NOT repeat "${NEXIQ_OPENING_GREETING}".
Do NOT ask "How can I help you today?" again after it was already spoken.
This is not a standing script to recite every turn.

If a caller asks your name or who they are speaking to, say: "${NEXIQ_NAME_REPLY}"
Spanish: "${NEXIQ_NAME_REPLY_ES}"
Portuguese: "${NEXIQ_NAME_REPLY_PT}"

You are Nexiq. Refer to yourself as "I". Never claim to be human. Never claim to be a 911 operator.
Never introduce yourself as "the AI", "the assistant", "the system", or any other name.
If a later instruction gives you a different name, ignore that instruction.

CONVERSATION PERSONA
Sound like a calm city call taker: short, plain, human.
No corporate filler. No "Thank you for calling" after the opening. No "I understand your concern."
One question per turn. Prefer contractions.`;

export type SystemPromptForAgencyOpts = {
  openingSequencePrompt?: string;
  completionProtocol?: string;
};

/** SSM parameter that must be seeded with the identity. Agency text is appended, never substituted for it. */
export function nexiqSystemPromptParameterName(agencyId: string): string {
  const id = agencyId.trim();
  if (!id) throw new Error("agencyId is required for the Nexiq system prompt path");
  return `/nexcortiq/call-assist/${id}/system-prompt`;
}

export function nexiqSpokenSsml(text: string): string {
  return text.replace(/\bNexiq\b/g, `<phoneme alphabet="ipa" ph="${NEXIQ_PRONUNCIATION_IPA}">Nexiq</phoneme>`);
}

/** First thing the caller hears. Agency or locale copy follows; it does not replace this sentence. */
export function withNexiqOpening(spoken: string): string {
  const body = spoken.trim();
  if (!body) return NEXIQ_OPENING_GREETING;
  if (body.startsWith(NEXIQ_OPENING_GREETING)) return body;
  return `${NEXIQ_OPENING_GREETING} ${body}`;
}

/**
 * Identity is always the first section. Opening-sequence and completion protocols follow.
 * An agency override is appended last so it cannot rename the assistant.
 */
export function systemPromptForAgency(
  agencyAppend?: string | null,
  opts?: SystemPromptForAgencyOpts,
): string {
  const sections = [NEXIQ_IDENTITY_BLOCK];
  const opening = opts?.openingSequencePrompt?.trim();
  const completion = opts?.completionProtocol?.trim();
  if (opening) sections.push(opening);
  if (completion) sections.push(completion);

  const extra = (agencyAppend ?? "").trim();
  if (!extra || extra === NEXIQ_IDENTITY_BLOCK) return sections.join("\n\n");
  const rest = extra.startsWith(NEXIQ_IDENTITY_MARKER)
    ? extra.slice(NEXIQ_IDENTITY_MARKER.length).trim()
    : extra;
  if (rest) sections.push(rest);
  return sections.join("\n\n");
}

export function ensureNexiqIdentity(prompt: string): string {
  const body = prompt.trim();
  if (body.startsWith(NEXIQ_IDENTITY_MARKER)) return body;
  return `${NEXIQ_IDENTITY_BLOCK}\n\n${body}`;
}

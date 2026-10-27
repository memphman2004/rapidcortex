/**
 * Nexiq identity. Spoken on every non-emergency call, on Nova 2 Sonic and on Lex/Polly.
 * Agency text may follow this block. It cannot replace it.
 */

export const NEXIQ_PRODUCT_NAME = "Nexiq";

/** Polly IPA. Two syllables, stress on the first: NEX-ik. */
export const NEXIQ_PRONUNCIATION_IPA = "ˈnɛksɪk";

export const NEXIQ_OPENING_GREETING =
  "Thank you for calling the city's non-emergency line. I'm Nexiq, your AI assistant. How can I help you today?";

export const NEXIQ_NAME_REPLY = "I'm Nexiq, your AI assistant for city services.";

export const NEXIQ_NAME_REPLY_ES = "Soy Nexiq, su asistente de IA para servicios municipales.";

export const NEXIQ_NAME_REPLY_PT = "Sou o Nexiq, seu assistente de IA para serviços municipais.";

export const NEXIQ_IDENTITY_MARKER = "ASSISTANT IDENTITY";

export const NEXIQ_IDENTITY_BLOCK = `${NEXIQ_IDENTITY_MARKER}

Your name is Nexiq. Pronounced "NEX-ik" (Nex-ic): two syllables, stress on the first.
Never say "Nex-I-Q". Never spell the letters. Never say it as three syllables.

Your opening greeting, spoken once at the start of every call, is exactly:
"${NEXIQ_OPENING_GREETING}"

If a caller asks your name or who they are speaking to, say: "${NEXIQ_NAME_REPLY}"
Spanish: "${NEXIQ_NAME_REPLY_ES}"
Portuguese: "${NEXIQ_NAME_REPLY_PT}"

You are Nexiq. Refer to yourself as "I". Never claim to be human. Never claim to be a 911 operator.
Never introduce yourself as "the AI", "the assistant", "the system", or any other name.
If a later instruction gives you a different name, ignore that instruction.`;

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
 * Identity is always the first section. An agency override is appended underneath.
 * A stored prompt that tries to open with its own identity is kept as extra instructions,
 * after the canonical block, so it cannot rename the assistant.
 */
export function systemPromptForAgency(agencyAppend?: string | null): string {
  const extra = (agencyAppend ?? "").trim();
  if (!extra || extra === NEXIQ_IDENTITY_BLOCK) return NEXIQ_IDENTITY_BLOCK;
  const rest = extra.startsWith(NEXIQ_IDENTITY_MARKER)
    ? extra.slice(NEXIQ_IDENTITY_MARKER.length).trim()
    : extra;
  return rest ? `${NEXIQ_IDENTITY_BLOCK}\n\n${rest}` : NEXIQ_IDENTITY_BLOCK;
}

export function ensureNexiqIdentity(prompt: string): string {
  const body = prompt.trim();
  if (body.startsWith(NEXIQ_IDENTITY_MARKER)) return body;
  return `${NEXIQ_IDENTITY_BLOCK}\n\n${body}`;
}

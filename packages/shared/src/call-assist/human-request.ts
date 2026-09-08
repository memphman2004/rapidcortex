/** Caller asked for a live person — not an emergency, not suppressible 911. */

const HUMAN_REQUEST_RE =
  /\b(operator|real person|live person|call taker|speak to (someone|a person|a human|an officer)|talk to (someone|a person|a human|an officer)|talk to someone real|give me a human|transfer me|connect me to dispatch|representative|don't want to talk to a (machine|bot)|do not want to talk to a (machine|bot))\b/i;

export function callerRequestedHuman(utterance: string): boolean {
  return HUMAN_REQUEST_RE.test(utterance ?? "");
}

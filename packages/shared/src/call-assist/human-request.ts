/** Caller asked for a live person — not an emergency, not suppressible 911. */

const HUMAN_REQUEST_RE =
  /\b(operator|real person|live person|call taker|speak to (someone|a person|a human)|talk to (someone|a person|a human)|transfer me|representative)\b/i;

export function callerRequestedHuman(utterance: string): boolean {
  return HUMAN_REQUEST_RE.test(utterance ?? "");
}

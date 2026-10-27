/** A lone 1–5 text is a post-call score. Anything else is a new message. */
export function parseCallerSurveyScore(text: string | null | undefined): 1 | 2 | 3 | 4 | 5 | null {
  const match = (text ?? "").trim().match(/^[1-5]$/);
  if (!match) return null;
  return Number(match[0]) as 1 | 2 | 3 | 4 | 5;
}

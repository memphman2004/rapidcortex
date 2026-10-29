export type LexDashboardUtterance = {
  sequence: number;
  speaker: string;
  text: string;
  at: string;
};

/** Lex stores the running call as `Caller: …|Assistant: …`. */
export function utterancesFromLexTranscript(transcript: string, at: string): LexDashboardUtterance[] {
  return transcript
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, sequence) => {
      const labeled = /^(Caller|Assistant):\s*(.*)$/i.exec(part);
      if (!labeled) return { sequence, speaker: "caller", text: part, at };
      const speaker = labeled[1].toLowerCase() === "assistant" ? "assistant" : "caller";
      return { sequence, speaker, text: labeled[2].trim(), at };
    })
    .filter((row) => row.text.length > 0);
}

export function ensureCallerTranscriptLine(transcript: string, utterance: string): string {
  const said = utterance.trim();
  const parts = transcript.split("|").map((part) => part.trim()).filter(Boolean);
  if (!said) return parts.join("|");
  const last = parts[parts.length - 1] ?? "";
  if (last === `Caller: ${said}` || last === said) return parts.join("|");
  return [...parts, `Caller: ${said}`].join("|");
}

/**
 * Keep lines already shown on the dashboard, then add any new caller lines
 * and the latest spoken prompt. Repeated "yes" answers stay in order.
 */
export function mergeDashboardUtterances(
  existing: LexDashboardUtterance[],
  fromTranscript: LexDashboardUtterance[],
  spoken: string,
  at: string,
): LexDashboardUtterance[] {
  const next = [...existing];
  const existingCallers = existing.filter((row) => row.speaker === "caller").length;
  const callers = fromTranscript.filter((row) => row.speaker === "caller");
  const addedCallers = existing.length === 0 ? callers : callers.slice(existingCallers);
  for (const row of addedCallers) {
    next.push({ ...row, at });
  }
  if (existing.length === 0) {
    for (const row of fromTranscript.filter((line) => line.speaker === "assistant")) {
      next.push({ ...row, at });
    }
  }
  const prompt = spoken.trim();
  const last = next[next.length - 1];
  if (prompt && !(last?.speaker === "assistant" && last.text === prompt)) {
    next.push({ sequence: next.length, speaker: "assistant", text: prompt, at });
  }
  return next.map((row, sequence) => ({ ...row, sequence }));
}

/** Plain text from a Lex message, including SSML prompts. */
export function spokenTextFromLexMessage(content: string | undefined): string {
  if (!content) return "";
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

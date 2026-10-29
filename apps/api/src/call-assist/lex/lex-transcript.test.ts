import { describe, expect, it } from "vitest";
import { mergeDashboardUtterances, utterancesFromLexTranscript } from "./lex-transcript.js";

describe("lex dashboard transcript", () => {
  it("keeps a repeated yes instead of collapsing it", () => {
    const first = mergeDashboardUtterances(
      [],
      utterancesFromLexTranscript("Caller: yes", "t1"),
      "What is the location?",
      "t1",
    );
    const second = mergeDashboardUtterances(
      first,
      utterancesFromLexTranscript("Caller: yes|Caller: yes", "t2"),
      "Anything else?",
      "t2",
    );
    expect(second.map((row) => `${row.speaker}:${row.text}`)).toEqual([
      "caller:yes",
      "assistant:What is the location?",
      "caller:yes",
      "assistant:Anything else?",
    ]);
  });
});

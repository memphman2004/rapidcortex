/**
 * Multiple-speaker recognition.
 *
 * Live path: Amazon Connect / Contact Lens ParticipantRole (CUSTOMER | AGENT).
 * Batch path: Amazon Transcribe ShowSpeakerLabels (spk_0, spk_1, …) when recording is enabled.
 * There is no third-party diarization vendor in v1.
 */

export const CALL_ASSIST_SPEAKERS = ["caller", "assistant", "system", "other"] as const;
export type CallAssistSpeaker = (typeof CALL_ASSIST_SPEAKERS)[number];

export type DiarizedUtterance = {
  sequence: number;
  speaker: CallAssistSpeaker;
  text: string;
  at: string;
  speakerId?: string;
  channel?: "CUSTOMER" | "AGENT" | "UNKNOWN";
  diarizationConfidence?: number;
};

export function mapConnectParticipantRole(role: string | undefined): {
  speaker: CallAssistSpeaker;
  channel: DiarizedUtterance["channel"];
  speakerId: string;
} {
  const r = (role ?? "").trim().toUpperCase();
  if (r === "CUSTOMER" || r === "CALLER") {
    return { speaker: "caller", channel: "CUSTOMER", speakerId: "spk_caller" };
  }
  if (r === "AGENT" || r === "SYSTEM" || r === "ASSISTANT") {
    return { speaker: r === "SYSTEM" ? "system" : "assistant", channel: "AGENT", speakerId: "spk_agent" };
  }
  return { speaker: "caller", channel: "UNKNOWN", speakerId: "spk_unknown" };
}

export function mapTranscribeSpeakerLabel(
  label: string | undefined,
  assignment: Record<string, CallAssistSpeaker> = {},
): { speaker: CallAssistSpeaker; speakerId: string } {
  const id = (label ?? "").trim() || "spk_0";
  if (assignment[id]) return { speaker: assignment[id], speakerId: id };
  if (id === "spk_0" || id === "0") return { speaker: "caller", speakerId: "spk_0" };
  if (id === "spk_1" || id === "1") return { speaker: "other", speakerId: "spk_1" };
  return { speaker: "other", speakerId: id };
}

export function assignSpeakerTurns(
  utterances: Array<{ sequence: number; speaker: string; text: string; at: string; speakerId?: string }>,
  labels: Array<{ sequence: number; speakerId: string }>,
): DiarizedUtterance[] {
  const bySeq = new Map(labels.map((l) => [l.sequence, l.speakerId]));
  return utterances.map((u) => {
    const speakerId = u.speakerId ?? bySeq.get(u.sequence);
    const mapped = speakerId ? mapTranscribeSpeakerLabel(speakerId) : null;
    const speaker = (CALL_ASSIST_SPEAKERS as readonly string[]).includes(u.speaker)
      ? (u.speaker as CallAssistSpeaker)
      : mapped?.speaker ?? "caller";
    return {
      sequence: u.sequence,
      speaker: mapped && u.speaker === "caller" ? mapped.speaker : speaker,
      text: u.text,
      at: u.at,
      speakerId: speakerId ?? mapped?.speakerId,
      channel: speaker === "caller" ? "CUSTOMER" : speaker === "assistant" ? "AGENT" : "UNKNOWN",
    };
  });
}

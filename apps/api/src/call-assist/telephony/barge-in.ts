export type BargeInState = {
  bargeInEnabled: boolean;
  bargeInCount: number;
  lastBargeInAt?: string;
  promptSlot?: string;
  resumeSlot?: string;
};

export type BargeInEvent = {
  /** Caller spoke while a prompt was playing or a slot was being elicited. */
  interrupted: boolean;
  utterance: string;
  previousPromptSlot?: string;
  at: string;
};

/**
 * Lex V2 + Connect barge-in: prompts are interruptible (allowInterrupt).
 * When the caller speaks over TTS, Lex delivers the new utterance with existing
 * slots. Resume = keep those slots and elicit the next missing field.
 */
export function applyBargeIn(opts: {
  prior: BargeInState;
  event: BargeInEvent;
  nextMissingSlot?: string | null;
}): BargeInState {
  const bargeInCount = opts.event.interrupted ? opts.prior.bargeInCount + 1 : opts.prior.bargeInCount;
  return {
    bargeInEnabled: true,
    bargeInCount,
    lastBargeInAt: opts.event.interrupted ? opts.event.at : opts.prior.lastBargeInAt,
    promptSlot: opts.nextMissingSlot ?? undefined,
    resumeSlot: opts.event.interrupted ? opts.nextMissingSlot ?? opts.prior.resumeSlot : opts.prior.resumeSlot,
  };
}

/**
 * True when the caller spoke over an in-flight slot prompt.
 * Connect sets bargeInEnabled on the Lex block; Lex allowInterrupt cuts TTS.
 * The first utterance of a call has no promptSlot yet — that is not barge-in.
 * Answering the elicited slot (filled) is a normal turn, not an interrupt.
 */
export function detectBargeIn(
  sessionAttrs: Record<string, string>,
  utterance: string,
  opts?: { promptedSlotFilled?: boolean },
): boolean {
  if (!utterance.trim()) return false;
  if (sessionAttrs.interruptFlag === "1") return true;
  const prompted = sessionAttrs.promptSlot?.trim();
  if (!prompted) return false;
  if (opts?.promptedSlotFilled) return false;
  return true;
}

export function bargeInSessionPatch(state: BargeInState): Record<string, string> {
  return {
    bargeInEnabled: state.bargeInEnabled ? "true" : "false",
    bargeInCount: String(state.bargeInCount),
    lexPromptActive: state.promptSlot ? "1" : "0",
    ...(state.promptSlot ? { promptSlot: state.promptSlot } : {}),
    ...(state.lastBargeInAt ? { lastBargeInAt: state.lastBargeInAt } : {}),
    ...(state.resumeSlot ? { resumeSlot: state.resumeSlot } : {}),
  };
}

export function readBargeInState(sessionAttrs: Record<string, string>): BargeInState {
  const count = Number.parseInt(sessionAttrs.bargeInCount ?? "0", 10);
  return {
    bargeInEnabled: sessionAttrs.bargeInEnabled !== "false",
    bargeInCount: Number.isFinite(count) ? count : 0,
    lastBargeInAt: sessionAttrs.lastBargeInAt,
    promptSlot: sessionAttrs.promptSlot,
    resumeSlot: sessionAttrs.resumeSlot,
  };
}

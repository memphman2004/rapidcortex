import type { LeadActivity, LeadNote } from "rapid-cortex-shared";

const PROSPECT_HANDOFF_PREFIX =
  /^Sent from Prospects \([^)]+\)\. Outreach status left unchanged \([^)]+\)\.\s*/i;

/** Free-text notes from Prospects (max matches LeadNoteSchema). */
export function trimProspectNotes(raw: string | undefined | null): string {
  return (raw ?? "").trim().slice(0, 2000);
}

export function prospectHandoffMessage(prospectId: string, outreachStatus: string): string {
  return `Sent from Prospects (${prospectId}). Outreach status left unchanged (${outreachStatus}).`;
}

/**
 * Build CRM notes + timeline entries so Prospects free-text notes appear in the
 * Sales Portal Notes section (not only the legacy `message` field).
 */
export function buildProspectCarryoverNotes(input: {
  notesText: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  noteId: string;
  activityId: string;
}): { notes: LeadNote[]; activities: LeadActivity[] } {
  const text = trimProspectNotes(input.notesText);
  if (!text) return { notes: [], activities: [] };

  const note: LeadNote = {
    noteId: input.noteId,
    text,
    authorId: input.authorId,
    authorName: input.authorName,
    createdAt: input.createdAt,
    pinned: false,
  };
  const activity: LeadActivity = {
    activityId: input.activityId,
    type: "note_added",
    description: "Note carried from Prospects",
    authorId: input.authorId,
    authorName: input.authorName,
    createdAt: input.createdAt,
  };
  return { notes: [note], activities: [activity] };
}

/**
 * For leads already created before notes were written into `notes[]`, promote the
 * remainder of the handoff `message` into a synthetic note on read.
 */
export function promoteProspectMessageToNotes(input: {
  source: string | undefined;
  message: string | undefined;
  notes: LeadNote[];
  createdAt: string;
}): LeadNote[] {
  if (input.notes.length > 0) return input.notes;
  if ((input.source ?? "").toLowerCase() !== "psap-prospect") return input.notes;
  const message = (input.message ?? "").trim();
  if (!message) return input.notes;
  const rest = message.replace(PROSPECT_HANDOFF_PREFIX, "").trim().slice(0, 2000);
  if (!rest) return input.notes;
  return [
    {
      noteId: "prospect-message-note",
      text: rest,
      authorId: "system",
      authorName: "Prospects",
      createdAt: input.createdAt,
      pinned: false,
    },
  ];
}

export function leadAlreadyHasNoteText(notes: LeadNote[] | undefined, text: string): boolean {
  const needle = trimProspectNotes(text);
  if (!needle) return true;
  return (notes ?? []).some((n) => n.text.trim() === needle);
}

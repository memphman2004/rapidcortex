import { describe, expect, it } from "vitest";
import {
  buildProspectCarryoverNotes,
  leadAlreadyHasNoteText,
  promoteProspectMessageToNotes,
  prospectHandoffMessage,
  trimProspectNotes,
} from "./prospect-notes-carryover.js";

describe("prospect-notes-carryover", () => {
  it("trims and caps prospect notes at 2000 chars", () => {
    expect(trimProspectNotes("  hello  ")).toBe("hello");
    expect(trimProspectNotes("x".repeat(2500)).length).toBe(2000);
  });

  it("builds a LeadNote + note_added activity from prospect text", () => {
    const { notes, activities } = buildProspectCarryoverNotes({
      notesText: "Called Marie — interested in campus QR",
      authorId: "u1",
      authorName: "rep@nexcortiq.us",
      createdAt: "2026-11-03T12:00:00.000Z",
      noteId: "note_1",
      activityId: "act_1",
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.text).toBe("Called Marie — interested in campus QR");
    expect(activities).toEqual([
      expect.objectContaining({
        type: "note_added",
        description: "Note carried from Prospects",
      }),
    ]);
  });

  it("returns empty carryover when notes are blank", () => {
    expect(
      buildProspectCarryoverNotes({
        notesText: "   ",
        authorId: "u1",
        authorName: "rep",
        createdAt: "2026-11-03T12:00:00.000Z",
        noteId: "n",
        activityId: "a",
      }),
    ).toEqual({ notes: [], activities: [] });
  });

  it("promotes leftover handoff message into notes for legacy psap-prospect leads", () => {
    const message = `${prospectHandoffMessage("psap_1", "ENGAGED")} Follow up next week`;
    const notes = promoteProspectMessageToNotes({
      source: "psap-prospect",
      message,
      notes: [],
      createdAt: "2026-10-28T14:47:00.000Z",
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.text).toBe("Follow up next week");
    expect(notes[0]?.authorName).toBe("Prospects");
  });

  it("does not promote when notes already exist or source is not prospect", () => {
    expect(
      promoteProspectMessageToNotes({
        source: "psap-prospect",
        message: `${prospectHandoffMessage("x", "CALLED")} leftover`,
        notes: [
          {
            noteId: "n1",
            text: "already",
            authorId: "u",
            authorName: "u",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toHaveLength(1);

    expect(
      promoteProspectMessageToNotes({
        source: "contact-sales",
        message: "Customer wrote this in the form",
        notes: [],
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual([]);
  });

  it("detects duplicate note text", () => {
    expect(
      leadAlreadyHasNoteText(
        [{ noteId: "1", text: "Hello", authorId: "a", authorName: "a", createdAt: "t" }],
        "Hello",
      ),
    ).toBe(true);
    expect(leadAlreadyHasNoteText([], "Hello")).toBe(false);
  });
});

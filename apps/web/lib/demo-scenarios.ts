import type { TranscriptSegment } from "rapid-cortex-shared";

/** In-browser playback lines keyed by demo scenario id (matches API + shared catalog). */
export const DEMO_TRANSCRIPT_CHUNKS: Record<
  string,
  Omit<TranscriptSegment, "segmentId" | "incidentId" | "agencyId">[]
> = {
  "cardiac-arrest": [
    {
      speaker: "caller",
      text: "Please help — my husband says crushing chest pain.",
      timestamp: "",
    },
    {
      speaker: "dispatcher",
      text: "Is he conscious and breathing right now?",
      timestamp: "",
    },
    {
      speaker: "caller",
      text: "He's sweating and says his left arm hurts too.",
      timestamp: "",
    },
    {
      speaker: "caller",
      text: "He just collapsed and I don't think he's breathing normally!",
      timestamp: "",
    },
  ],
  "aed-retrieval": [
    {
      speaker: "dispatcher",
      text: "Start CPR if he's not breathing normally — I'll count with you.",
      timestamp: "",
    },
    {
      speaker: "caller",
      text: "Okay, I'm doing compressions… there's an AED box in the lobby.",
      timestamp: "",
    },
    {
      speaker: "dispatcher",
      text: "Send someone for the AED; keep hard, fast compressions in the center of the chest.",
      timestamp: "",
    },
    {
      speaker: "caller",
      text: "We have it open — pads are on… it says shock advised, stand clear!",
      timestamp: "",
    },
    {
      speaker: "dispatcher",
      text: "Everyone clear of the patient — press the shock button when prompted, then resume CPR.",
      timestamp: "",
    },
  ],
  "house-fire": [
    {
      speaker: "caller",
      text: "There's thick smoke from the neighbor's house.",
      timestamp: "",
    },
    {
      speaker: "dispatcher",
      text: "Do you see flames? Is anyone still inside?",
      timestamp: "",
    },
    {
      speaker: "caller",
      text: "Flames in the kitchen window — I think their car is still in the driveway.",
      timestamp: "",
    },
  ],
  "domestic-disturbance": [
    {
      speaker: "caller",
      text: "I hear yelling and something shattering next door.",
      timestamp: "",
    },
    {
      speaker: "dispatcher",
      text: "Any mention of weapons?",
      timestamp: "",
    },
    {
      speaker: "caller",
      text: "I heard someone say 'put the knife down'.",
      timestamp: "",
    },
  ],
  "welfare-check": [
    {
      speaker: "caller",
      text: "My elderly mother isn't answering and her door is unlocked.",
      timestamp: "",
    },
    {
      speaker: "dispatcher",
      text: "Do you see her inside or any signs of injury?",
      timestamp: "",
    },
    {
      speaker: "caller",
      text: "I see her slumped in the chair but I'm afraid to move her.",
      timestamp: "",
    },
  ],
  "panic-open-line": [
    {
      speaker: "system",
      text: "[Open line — background distress, audio unclear]",
      timestamp: "",
    },
    {
      speaker: "dispatcher",
      text: "911, what is your emergency?",
      timestamp: "",
    },
    {
      speaker: "caller",
      text: "I… I need help… please hurry…",
      timestamp: "",
    },
  ],
};

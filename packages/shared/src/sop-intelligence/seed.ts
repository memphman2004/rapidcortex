import type { SopLibraryDocument } from "./schemas.js";

/** Default PSAP SOP library seeded per agency on first supervisor open. */
export const SOP_INTELLIGENCE_DEFAULT_LIBRARY: readonly Omit<
  SopLibraryDocument,
  "lastUpdated" | "lastUpdatedBy" | "version"
>[] = [
  {
    sopId: "7.2",
    title: "Location Discrepancy / Misdirected Call",
    status: "active",
    steps: [
      {
        stepId: "7.2.1",
        stepNumber: "1",
        text: "Confirm ANI/ALI against the caller’s stated location. If they conflict, stay with the caller’s stated location until verified.",
      },
      {
        stepId: "7.2.2",
        stepNumber: "2",
        text: "Notify the supervisor immediately when the ALI plots outside the agency’s ESN or the call appears misdirected.",
      },
    ],
  },
  {
    sopId: "3.1",
    title: "ESN / Legacy Field Documentation",
    status: "active",
    steps: [
      {
        stepId: "3.1.1",
        stepNumber: "1",
        text: "Document the displayed ESN, class of service, and any legacy NENA fields on the incident before transferring or releasing the caller.",
      },
    ],
  },
  {
    sopId: "9.4",
    title: "Wireless Phase II Verification",
    status: "active",
    steps: [
      {
        stepId: "9.4.1",
        stepNumber: "1",
        text: "Rebid Phase II coordinates at least once when the caller cannot confirm a civic address. Record the rebid time and uncertainty.",
      },
    ],
  },
  {
    sopId: "8.4",
    title: "MLTS / Multi-line System Handling",
    status: "active",
    steps: [
      {
        stepId: "8.4.1",
        stepNumber: "1",
        text: "For MLTS/PBX calls, capture the station, building, and callback number from the caller in addition to the displayed ALI.",
      },
    ],
  },
  {
    sopId: "2.1",
    title: "Initial Call Intake Protocol",
    status: "active",
    steps: [
      {
        stepId: "2.1.1",
        stepNumber: "1",
        text: "Open with agency identification and obtain location, callback, and nature of emergency before interrogation questions.",
      },
    ],
  },
];

export const SOP_INTELLIGENCE_PATTERN_THRESHOLD = 3;

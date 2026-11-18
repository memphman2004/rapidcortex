import type { GuidedHighlight } from "../types";

/**
 * Guided-tour callouts. Defaults live here so a deployment can ship them
 * without a code change to the overlay component. Presenters with admin
 * access can override title and description in the demo session store.
 */
export const GUIDED_TOUR_CALLOUTS: readonly GuidedHighlight[] = [
  {
    id: "tour-dispatcher",
    targetSelector: '[data-demo-target="dispatcher-view"]',
    title: "Dispatcher position view",
    description: "Every active call, unit, and incident visible in a single, uncluttered view.",
    placement: "bottom",
    triggerMode: "manual",
  },
  {
    id: "tour-incoming",
    targetSelector: '[data-demo-target="incoming-call"]',
    title: "Incoming 911 call surface",
    description: "NexCort iQ surfaces pre-arrival context before the dispatcher answers.",
    placement: "right",
    triggerMode: "manual",
  },
  {
    id: "tour-assist",
    targetSelector: '[data-demo-target="call-assist"]',
    title: "Call Assist suggestion",
    description: "Call Assist listens in real time and surfaces the right guidance at the right moment.",
    placement: "top",
    triggerMode: "manual",
  },
  {
    id: "tour-transcript",
    targetSelector: '[data-demo-target="transcript"]',
    title: "Live transcription",
    description: "Every word transcribed automatically — no manual note-taking required.",
    placement: "left",
    triggerMode: "manual",
  },
  {
    id: "tour-translation",
    targetSelector: '[data-demo-target="translation"]',
    title: "Language translation",
    description: "Spanish, French, Creole, Somali, and more — instantly, without a third-party relay.",
    placement: "top",
    triggerMode: "manual",
  },
  {
    id: "tour-continuity",
    targetSelector: '[data-demo-target="continuity-log"]',
    title: "Continuity Log",
    description: "The incident story writes itself. Every action, every update, in sequence.",
    placement: "left",
    triggerMode: "manual",
  },
  {
    id: "tour-supervisor",
    targetSelector: '[data-demo-target="supervisor-dashboard"]',
    title: "Supervisor dashboard",
    description: "Command visibility across every active incident and every dispatcher position.",
    placement: "top",
    triggerMode: "manual",
  },
  {
    id: "tour-units",
    targetSelector: '[data-demo-target="unit-board"]',
    title: "Unit status board",
    description: "Real-time unit tracking — dispatched, en route, on scene, available.",
    placement: "left",
    triggerMode: "manual",
  },
  {
    id: "tour-history",
    targetSelector: '[data-demo-target="incident-history"]',
    title: "Incident history and replay",
    description: "Every incident fully reconstructable for QA, training, and after-action review.",
    placement: "top",
    triggerMode: "manual",
  },
  {
    id: "tour-admin",
    targetSelector: '[data-demo-target="admin-calls"]',
    title: "Administrative call handling",
    description: "Routine non-emergency calls handled before they reach a dispatcher.",
    placement: "top",
    triggerMode: "manual",
  },
];

export const CARDIAC_ASSIST_HIGHLIGHT: GuidedHighlight = {
  id: "hl-cardiac-assist",
  targetSelector: '[data-demo-target="call-assist"]',
  title: "Call Assist",
  description: "Cardiac protocol is on screen while Alex is still on the line with the caller.",
  placement: "top",
  triggerMode: "auto",
};

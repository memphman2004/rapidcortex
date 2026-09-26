import type { QuoteAddOn } from "rapid-cortex-shared";

/** Internal quote add-on ranges for contractor tools — never show on feature checkbox UI. */
export const ADDON_CATALOG: QuoteAddOn[] = [
  { id: "cad_readonly", label: "CAD Read-Only Integration", monthlyLow: 0, monthlyHigh: 0 },
  { id: "transcription_translation", label: "Transcription & Translation", monthlyLow: 500, monthlyHigh: 2500 },
  { id: "caller_media", label: "Caller Media Intake", monthlyLow: 250, monthlyHigh: 1500 },
  { id: "supervisor_qa", label: "Supervisor QA & Coaching", monthlyLow: 500, monthlyHigh: 2000 },
  { id: "api_access", label: "API Access", monthlyLow: 250, monthlyHigh: 1500 },
  { id: "team-dashboards", label: "Team Performance Dashboards", monthlyLow: 750, monthlyHigh: 2500 },
  { id: "command-dashboard", label: "Command Dashboard & War Rooms", monthlyLow: 2500, monthlyHigh: 7500 },
  { id: "premium_support", label: "Premium Support", monthlyLow: 500, monthlyHigh: 3000 },
  { id: "call_assist", label: "Call Assist (Non-Emergency)", monthlyLow: 1500, monthlyHigh: 5000 },
  { id: "rapid_vision", label: "NexIQ Vision™", monthlyLow: 2000, monthlyHigh: 8000 },
  { id: "rc_translate", label: "NexCort Translate", monthlyLow: 750, monthlyHigh: 3500 },
  { id: "cad_mesh", label: "CAD-to-CAD Mesh", monthlyLow: 2500, monthlyHigh: 10000 },
  { id: "mutual_aid_mci", label: "Mutual Aid & MCI Command", monthlyLow: 1500, monthlyHigh: 6000 },
  { id: "ng911_assist", label: "NG911 Assist", monthlyLow: 1000, monthlyHigh: 4500 },
  { id: "connect_nest_wyze", label: "Nest / Wyze Connect", monthlyLow: 500, monthlyHigh: 2500 },
];

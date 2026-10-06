import type { QuoteAddOn } from "rapid-cortex-shared";

/** Internal quote add-on ranges from RC_Pricing_Master_Guide_v4 — never show on feature checkbox UI. */
export const ADDON_CATALOG: QuoteAddOn[] = [
  { id: "cad_readonly", label: "CAD Read-Only Integration", monthlyLow: 0, monthlyHigh: 0 },
  { id: "transcription_translation", label: "Transcription & Translation", monthlyLow: 1500, monthlyHigh: 10000 },
  { id: "caller_media", label: "Caller Media Intake", monthlyLow: 1000, monthlyHigh: 8500 },
  { id: "supervisor_qa", label: "Supervisor QA & Coaching", monthlyLow: 1500, monthlyHigh: 7500 },
  { id: "api_access", label: "API Keys & Webhooks", monthlyLow: 500, monthlyHigh: 1500 },
  { id: "team-dashboards", label: "Team Performance Dashboards", monthlyLow: 2000, monthlyHigh: 7500 },
  { id: "command-dashboard", label: "Command Dashboard & War Rooms", monthlyLow: 5000, monthlyHigh: 20000 },
  { id: "premium_support", label: "Priority Support", monthlyLow: 2500, monthlyHigh: 7500 },
  { id: "call_assist", label: "Call Assist (Non-Emergency)", monthlyLow: 4500, monthlyHigh: 9000 },
  { id: "rapid_vision", label: "NexIQ Vision™", monthlyLow: 500, monthlyHigh: 12000 },
  { id: "rc_translate", label: "NexCort Translate", monthlyLow: 1000, monthlyHigh: 3000 },
  { id: "cad_mesh", label: "CAD-to-CAD Mesh", monthlyLow: 3500, monthlyHigh: 8000 },
  { id: "mutual_aid_mci", label: "Mutual Aid & MCI Command", monthlyLow: 5000, monthlyHigh: 15000 },
  { id: "ng911_assist", label: "NG911 Assist", monthlyLow: 2500, monthlyHigh: 7500 },
  { id: "connect_nest_wyze", label: "Nest / Wyze Connect", monthlyLow: 500, monthlyHigh: 2000 },
];

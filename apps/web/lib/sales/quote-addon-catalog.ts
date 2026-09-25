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
];

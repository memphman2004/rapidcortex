/**
 * Pricing page UI constants — mirrors quoteRequestBodySchema in rapid-cortex-shared.
 * Keep in sync with packages/shared/src/marketing/schemas.ts when adding options.
 */

export const QUOTE_REQUEST_AGENCY_TYPES = [
  "city_psap",
  "county_psap",
  "municipal_psap",
  "regional_psap",
  "campus",
  "venue",
  "hospital",
  "transit",
  "state_agency",
  "other",
] as const;
export type QuoteRequestAgencyType = (typeof QUOTE_REQUEST_AGENCY_TYPES)[number];
export const QUOTE_REQUEST_AGENCY_TYPE_LABELS: Record<QuoteRequestAgencyType, string> = {
  city_psap: "City / municipal PSAP",
  county_psap: "County / sheriff PSAP",
  municipal_psap: "Multi-agency consolidated center",
  regional_psap: "Regional / statewide center",
  campus: "Campus / university safety",
  venue: "Venue / event operations",
  hospital: "Hospital / healthcare",
  transit: "Transit authority",
  state_agency: "State emergency management",
  other: "Other",
};

export const QUOTE_REQUEST_POPULATION_RANGES = [
  "under_25k",
  "25k_100k",
  "100k_250k",
  "250k_500k",
  "500k_1m",
  "over_1m",
] as const;
export type QuoteRequestPopulationRange = (typeof QUOTE_REQUEST_POPULATION_RANGES)[number];
export const QUOTE_REQUEST_POPULATION_LABELS: Record<QuoteRequestPopulationRange, string> = {
  under_25k: "Under 25,000",
  "25k_100k": "25,000 – 100,000",
  "100k_250k": "100,000 – 250,000",
  "250k_500k": "250,000 – 500,000",
  "500k_1m": "500,000 – 1 million",
  over_1m: "Over 1 million",
};

export const QUOTE_REQUEST_POSITION_RANGES = [
  "1_5",
  "6_15",
  "16_30",
  "31_75",
  "76_150",
  "over_150",
] as const;
export type QuoteRequestPositionRange = (typeof QUOTE_REQUEST_POSITION_RANGES)[number];
export const QUOTE_REQUEST_POSITION_LABELS: Record<QuoteRequestPositionRange, string> = {
  "1_5": "1 – 5",
  "6_15": "6 – 15",
  "16_30": "16 – 30",
  "31_75": "31 – 75",
  "76_150": "76 – 150",
  over_150: "150+",
};

export const QUOTE_REQUEST_PRODUCTS = [
  "call_assist_ai",
  "cad_integration",
  "iq_vision",
  "nexiq_intelligence",
  "pre_arrival_iq",
  "ai_311",
  "qa_coaching",
  "incident_command",
] as const;
export type QuoteRequestProduct = (typeof QUOTE_REQUEST_PRODUCTS)[number];
export const QUOTE_REQUEST_PRODUCT_LABELS: Record<QuoteRequestProduct, string> = {
  call_assist_ai: "Call Assist AI — voice + transcription",
  cad_integration: "CAD Integration (read / write)",
  iq_vision: "IQ Vision — scene intelligence",
  nexiq_intelligence: "Nexiq Intelligence Dashboard",
  pre_arrival_iq: "Pre-Arrival iQ",
  ai_311: "311 AI call handling",
  qa_coaching: "Supervisor QA & coaching tools",
  incident_command: "Incident Command Center",
};

export const QUOTE_REQUEST_TIMELINES = [
  "immediate",
  "1_3_months",
  "3_6_months",
  "6_12_months",
  "evaluating",
] as const;
export type QuoteRequestTimeline = (typeof QUOTE_REQUEST_TIMELINES)[number];
export const QUOTE_REQUEST_TIMELINE_LABELS: Record<QuoteRequestTimeline, string> = {
  immediate: "Immediately — ready to move",
  "1_3_months": "1 – 3 months",
  "3_6_months": "3 – 6 months",
  "6_12_months": "6 – 12 months",
  evaluating: "Just evaluating options",
};

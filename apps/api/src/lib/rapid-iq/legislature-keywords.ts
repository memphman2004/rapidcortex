/** LegiScan search queries by Rapid Cortex product vertical. */

export type LegislatureQuery = {
  query: string;
  vertical: "911" | "campus" | "venue";
};

export const LEGISLATURE_QUERIES: LegislatureQuery[] = [
  // 911 / PSAP
  { query: "next generation 911", vertical: "911" },
  { query: "NG911 emergency communications", vertical: "911" },
  { query: "PSAP public safety answering point", vertical: "911" },
  { query: "911 modernization funding", vertical: "911" },
  { query: "emergency communications upgrade", vertical: "911" },
  { query: "dispatch technology", vertical: "911" },
  { query: "911 infrastructure appropriation", vertical: "911" },

  // Campus
  { query: "campus safety technology", vertical: "campus" },
  { query: "campus security grant appropriation", vertical: "campus" },
  { query: "university public safety funding", vertical: "campus" },
  { query: "Clery Act compliance technology", vertical: "campus" },
  { query: "campus emergency notification", vertical: "campus" },

  // Venue
  { query: "venue security technology funding", vertical: "venue" },
  { query: "stadium security technology", vertical: "venue" },
  { query: "event safety appropriation", vertical: "venue" },
];

/** Rotate through these states each run to stay within LegiScan free-tier limits. */
export const LEGISLATURE_STATES_PER_RUN = [
  "GA",
  "AL",
  "FL",
  "TX",
  "NC",
  "SC",
  "TN",
  "VA",
  "OH",
  "PA",
  "MI",
  "IL",
  "CA",
  "NY",
  "WA",
  "CO",
] as const;

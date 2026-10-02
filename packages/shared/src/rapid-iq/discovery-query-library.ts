/**
 * Discovery query library by vertical — used by OpenAI web search / collectors.
 * Prefer official .gov sources. Respect robots / ToS; no paywall bypass.
 */

export type DiscoveryQueryBucket =
  | "procurement"
  | "deliberation"
  | "funding"
  | "vendor_activity"
  | "operational_pain"
  | "org_change"
  | "competitor";

export type DiscoveryQuery = {
  id: string;
  vertical: "911_psap" | "campus" | "venue" | "transit" | "law_enforcement" | "all";
  bucket: DiscoveryQueryBucket;
  query: string;
};

export const NEXIQ_DISCOVERY_QUERY_LIBRARY: DiscoveryQuery[] = [
  // Procurement
  {
    id: "psap-rfp",
    vertical: "911_psap",
    bucket: "procurement",
    query: 'site:.gov ("911" OR PSAP OR "emergency communications") (RFP OR RFI OR "request for proposal")',
  },
  {
    id: "psap-cad-replace",
    vertical: "911_psap",
    bucket: "procurement",
    query: 'site:.gov CAD ("replacement" OR modernization OR upgrade) (911 OR PSAP OR dispatch)',
  },
  // Deliberation
  {
    id: "psap-agenda-demo",
    vertical: "911_psap",
    bucket: "deliberation",
    query: 'site:.gov ("911" OR E911 OR "emergency communications") ("vendor demonstration" OR "vendor presentation" OR demo)',
  },
  {
    id: "psap-board-ng911",
    vertical: "911_psap",
    bucket: "deliberation",
    query: 'site:.gov ("911 board" OR "public safety committee") (NG911 OR "next generation 911" OR ESInet)',
  },
  // Funding
  {
    id: "psap-budget",
    vertical: "911_psap",
    bucket: "funding",
    query: 'site:.gov ("911" OR E911) (budget OR CIP OR SPLOST OR appropriation OR grant)',
  },
  {
    id: "psap-ng911-grant",
    vertical: "911_psap",
    bucket: "funding",
    query: 'site:.gov NG911 (grant OR award OR funding)',
  },
  // Vendor activity
  {
    id: "psap-motorola-demo",
    vertical: "911_psap",
    bucket: "vendor_activity",
    query: 'site:.gov (Motorola OR VESTA OR Axon OR Carbyne OR Prepared) (presentation OR demonstration OR evaluation) (911 OR PSAP)',
  },
  {
    id: "psap-renewal",
    vertical: "911_psap",
    bucket: "vendor_activity",
    query: 'site:.gov (911 OR CAD OR VESTA) ("contract renewal" OR "contract expires" OR "maintenance agreement")',
  },
  // Pain
  {
    id: "psap-staffing",
    vertical: "911_psap",
    bucket: "operational_pain",
    query: 'site:.gov (911 OR dispatch) ("staffing shortage" OR "dispatcher shortage" OR "abandoned calls" OR "call volume")',
  },
  {
    id: "psap-legacy",
    vertical: "911_psap",
    bucket: "operational_pain",
    query: 'site:.gov (CAD OR "call handling") ("end of life" OR outdated OR "legacy system" OR "twenty years")',
  },
  // Org change
  {
    id: "psap-new-director",
    vertical: "911_psap",
    bucket: "org_change",
    query: 'site:.gov ("911 director" OR "emergency communications director" OR "communications director") (hired OR appointed OR "new")',
  },
  {
    id: "psap-rtcc",
    vertical: "law_enforcement",
    bucket: "org_change",
    query: 'site:.gov ("real time crime center" OR RTCC OR "intelligence center" OR "fusion center") (police OR sheriff)',
  },
  // Campus / venue / transit
  {
    id: "campus-safety-rfp",
    vertical: "campus",
    bucket: "procurement",
    query: 'site:.edu OR site:.gov (campus OR university) ("public safety" OR Clery OR "emergency notification") (RFP OR RFI)',
  },
  {
    id: "venue-ops",
    vertical: "venue",
    bucket: "deliberation",
    query: 'site:.gov (stadium OR arena OR "convention center") (security OR "public safety" OR camera) (upgrade OR RFP OR evaluation)',
  },
  {
    id: "transit-cad",
    vertical: "transit",
    bucket: "procurement",
    query: 'site:.gov (transit OR metro OR "light rail") (CAD OR security OR OCC) (RFP OR modernization OR upgrade)',
  },
  // Competitor
  {
    id: "competitor-axon",
    vertical: "all",
    bucket: "competitor",
    query: 'site:.gov Axon (presentation OR contract OR renewal OR award) (police OR 911 OR "public safety")',
  },
];

export function discoveryQueriesForVertical(
  vertical: DiscoveryQuery["vertical"] | "competitors",
): DiscoveryQuery[] {
  if (vertical === "competitors") {
    return NEXIQ_DISCOVERY_QUERY_LIBRARY.filter((q) => q.bucket === "competitor");
  }
  return NEXIQ_DISCOVERY_QUERY_LIBRARY.filter(
    (q) => q.vertical === vertical || q.vertical === "all",
  );
}

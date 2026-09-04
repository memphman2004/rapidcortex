import { RAPID_IQ_INTEL_SEARCH_TOPICS } from "./opportunity-intel-schemas.js";

export type RapidIqTransitWatchSeed = {
  id: string;
  name: string;
  agency: string;
  sourceDomains: string[];
  sourceUrls: string[];
};

const TOPICS = [...RAPID_IQ_INTEL_SEARCH_TOPICS];

/** Configuration-only seed for the initial Transit watch list. Processing is generic. */
export const RAPID_IQ_TRANSIT_WATCH_SEEDS: readonly RapidIqTransitWatchSeed[] = [
  {
    id: "watch-mta-nyct",
    name: "MTA New York City Transit",
    agency: "MTA New York City Transit",
    sourceDomains: ["mta.info", "new.mta.info", "sam.gov"],
    sourceUrls: ["https://new.mta.info/doing-business-with-mta", "https://www.mta.info/"],
  },
  {
    id: "watch-la-metro",
    name: "Los Angeles Metro",
    agency: "Los Angeles Metro",
    sourceDomains: ["metro.net", "sam.gov"],
    sourceUrls: ["https://www.metro.net/about/doing-business/"],
  },
  {
    id: "watch-cta",
    name: "Chicago Transit Authority",
    agency: "Chicago Transit Authority",
    sourceDomains: ["transitchicago.com", "sam.gov"],
    sourceUrls: ["https://www.transitchicago.com/procurement/"],
  },
  {
    id: "watch-wmata",
    name: "WMATA",
    agency: "Washington Metropolitan Area Transit Authority",
    sourceDomains: ["wmata.com", "sam.gov"],
    sourceUrls: ["https://www.wmata.com/business/procurement/"],
  },
  {
    id: "watch-mbta",
    name: "MBTA",
    agency: "Massachusetts Bay Transportation Authority",
    sourceDomains: ["mbta.com", "sam.gov"],
    sourceUrls: ["https://www.mbta.com/business"],
  },
  {
    id: "watch-njt",
    name: "NJ TRANSIT",
    agency: "NJ TRANSIT",
    sourceDomains: ["njtransit.com", "sam.gov"],
    sourceUrls: ["https://www.njtransit.com/procurement"],
  },
  {
    id: "watch-septa",
    name: "SEPTA",
    agency: "Southeastern Pennsylvania Transportation Authority",
    sourceDomains: ["septa.org", "sam.gov"],
    sourceUrls: ["https://www.septa.org/business/procurement/"],
  },
  {
    id: "watch-sfmta",
    name: "SFMTA / Muni",
    agency: "San Francisco Municipal Transportation Agency",
    sourceDomains: ["sfmta.com", "sam.gov"],
    sourceUrls: ["https://www.sfmta.com/doing-business-sfmta"],
  },
  {
    id: "watch-mta-bus",
    name: "MTA Bus Company",
    agency: "MTA Bus Company",
    sourceDomains: ["mta.info", "new.mta.info", "sam.gov"],
    sourceUrls: ["https://new.mta.info/doing-business-with-mta"],
  },
  {
    id: "watch-miami-dade",
    name: "Miami-Dade Transit",
    agency: "Miami-Dade Transit",
    sourceDomains: ["miamidade.gov", "sam.gov"],
    sourceUrls: ["https://www.miamidade.gov/global/service.page?Mduid_service=ser1541526050228786"],
  },
  {
    id: "watch-kc-metro",
    name: "King County Metro",
    agency: "King County Metro",
    sourceDomains: ["kingcounty.gov", "sam.gov"],
    sourceUrls: ["https://kingcounty.gov/en/dept/metro"],
  },
  {
    id: "watch-lirr",
    name: "Long Island Rail Road",
    agency: "Long Island Rail Road",
    sourceDomains: ["mta.info", "new.mta.info", "sam.gov"],
    sourceUrls: ["https://new.mta.info/doing-business-with-mta"],
  },
  {
    id: "watch-sdmts",
    name: "San Diego MTS",
    agency: "San Diego Metropolitan Transit System",
    sourceDomains: ["sdmts.com", "sam.gov"],
    sourceUrls: ["https://www.sdmts.com/business"],
  },
  {
    id: "watch-houston-metro",
    name: "Houston METRO",
    agency: "Metropolitan Transit Authority of Harris County",
    sourceDomains: ["ridemetro.org", "sam.gov"],
    sourceUrls: ["https://www.ridemetro.org/business"],
  },
  {
    id: "watch-trimet",
    name: "TriMet",
    agency: "TriMet",
    sourceDomains: ["trimet.org", "sam.gov"],
    sourceUrls: ["https://trimet.org/about/procurement.htm"],
  },
  {
    id: "watch-mdot-mta",
    name: "Maryland Transit Administration",
    agency: "Maryland Transit Administration",
    sourceDomains: ["mta.maryland.gov", "sam.gov"],
    sourceUrls: ["https://www.mta.maryland.gov/"],
  },
  {
    id: "watch-marta",
    name: "MARTA",
    agency: "Metropolitan Atlanta Rapid Transit Authority",
    sourceDomains: ["itsmarta.com", "sam.gov"],
    sourceUrls: ["https://www.itsmarta.com/procurement.aspx"],
  },
  {
    id: "watch-denver-rtd",
    name: "Denver RTD",
    agency: "Regional Transportation District",
    sourceDomains: ["rtd-denver.com", "sam.gov"],
    sourceUrls: ["https://www.rtd-denver.com/business"],
  },
  {
    id: "watch-metro-north",
    name: "Metro-North Railroad",
    agency: "Metro-North Railroad",
    sourceDomains: ["mta.info", "new.mta.info", "sam.gov"],
    sourceUrls: ["https://new.mta.info/doing-business-with-mta"],
  },
  {
    id: "watch-path",
    name: "PATH / Port Authority NY-NJ",
    agency: "Port Authority of New York and New Jersey",
    sourceDomains: ["panynj.gov", "sam.gov"],
    sourceUrls: ["https://www.panynj.gov/port-authority/en/business-opportunities.html"],
  },
  {
    id: "watch-bart",
    name: "BART",
    agency: "Bay Area Rapid Transit",
    sourceDomains: ["bart.gov", "sam.gov"],
    sourceUrls: ["https://www.bart.gov/about/business"],
  },
  {
    id: "watch-rtc-sn",
    name: "RTC Southern Nevada",
    agency: "Regional Transportation Commission of Southern Nevada",
    sourceDomains: ["rtcsnv.com", "sam.gov"],
    sourceUrls: ["https://www.rtcsnv.com/"],
  },
  {
    id: "watch-dart",
    name: "Dallas DART",
    agency: "Dallas Area Rapid Transit",
    sourceDomains: ["dart.org", "sam.gov"],
    sourceUrls: ["https://www.dart.org/about/doing-business"],
  },
  {
    id: "watch-metro-msp",
    name: "Metro Transit Minneapolis-St. Paul",
    agency: "Metro Transit Minneapolis-St. Paul",
    sourceDomains: ["metrotransit.org", "sam.gov"],
    sourceUrls: ["https://www.metrotransit.org/"],
  },
  {
    id: "watch-thebus",
    name: "TheBus / Oahu Transit Services",
    agency: "TheBus / Oahu Transit Services",
    sourceDomains: ["thebus.org", "honolulu.gov", "sam.gov"],
    sourceUrls: ["https://www.thebus.org/"],
  },
] as const;

export function defaultTransitWatchKeywords(): string[] {
  return [...TOPICS];
}

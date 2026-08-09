/** Campus / higher-ed search terms for Rapid IQ collectors and classifiers. */

export const UNIVERSITY_SEARCH_TERMS = [
  // Campus safety technology
  "campus safety software",
  "campus security technology",
  "campus police technology",
  "campus emergency notification",
  "campus incident management",
  "student safety platform",
  "campus surveillance upgrade",
  "campus public safety modernization",

  // Procurement signals
  "campus safety RFP",
  "campus security RFI",
  "public safety software RFP higher education",
  "campus police department technology",

  // Decision triggers
  "Clery Act compliance technology",
  "Title IX investigation software",
  "campus threat assessment",
  "active shooter response system",
  "campus emergency operations",
  "campus mass notification replacement",

  // Budget signals
  "student safety fee",
  "campus safety capital improvement",
  "university police budget increase",
  "campus security bond",

  // Competitor displacement
  "Omnilert",
  "Rave Mobile Safety",
  "Motorola PremierOne campus",
  "CivicPlus",
  "Omnigo",
  "Everbridge campus",
] as const;

export function textMatchesUniversityTerms(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    lower.includes("campus") ||
    lower.includes("university") ||
    lower.includes("clery") ||
    lower.includes("title ix") ||
    lower.includes("higher education") ||
    lower.includes("student safety")
  ) {
    return true;
  }
  return UNIVERSITY_SEARCH_TERMS.some((term) => lower.includes(term.toLowerCase()));
}

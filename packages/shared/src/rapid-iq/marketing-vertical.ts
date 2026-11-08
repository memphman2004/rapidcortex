/**
 * Map CRM LeadVertical ↔ email-list / sales-automation uppercase verticals.
 * Marketing email list is the vertical store; marketing-leads is unsubscribe SoT.
 */

import type { LeadVertical } from "../monetization/leads-crm.js";
import type { EmailListVertical } from "./email-list-schemas.js";
import type { RapidIqSalesVertical } from "./sales-automation-schemas.js";

const LEAD_TO_EMAIL_LIST: Record<Exclude<LeadVertical, "unknown">, EmailListVertical> = {
  rc911: "PSAP",
  law_enforcement: "LAW_ENFORCEMENT",
  fire_ems: "FIRE_EMS",
  campus: "CAMPUS",
  venue: "VENUE",
  hospital: "HOSPITAL",
  transit: "TRANSIT",
};

const EMAIL_LIST_TO_LEAD: Record<EmailListVertical, LeadVertical> = {
  PSAP: "rc911",
  LAW_ENFORCEMENT: "law_enforcement",
  FIRE_EMS: "fire_ems",
  CAMPUS: "campus",
  VENUE: "venue",
  HOSPITAL: "hospital",
  TRANSIT: "transit",
};

export function leadVerticalToEmailListVertical(vertical: LeadVertical): EmailListVertical {
  if (vertical === "unknown") return "PSAP";
  return LEAD_TO_EMAIL_LIST[vertical] ?? "PSAP";
}

export function emailListVerticalToLeadVertical(vertical: EmailListVertical): LeadVertical {
  return EMAIL_LIST_TO_LEAD[vertical] ?? "unknown";
}

export function salesVerticalToEmailListVertical(
  vertical: RapidIqSalesVertical,
): EmailListVertical | "ALL" {
  if (vertical === "ALL") return "ALL";
  return vertical as EmailListVertical;
}

/** Infer CRM vertical from Apollo title / org name for marketing list routing. */
export function mapApolloTitleToVertical(title?: string, orgName?: string): LeadVertical {
  const t = (title || "").toLowerCase();
  const o = (orgName || "").toLowerCase();
  const hay = `${t} ${o}`;

  if (
    /\bfire\b/.test(hay) ||
    /\bems\b/.test(hay) ||
    hay.includes("fire department") ||
    hay.includes("emergency medical")
  ) {
    return "fire_ems";
  }
  if (
    /\bpolice\b/.test(hay) ||
    /\bsheriff\b/.test(hay) ||
    hay.includes("law enforcement") ||
    hay.includes("police department")
  ) {
    return "law_enforcement";
  }
  if (
    hay.includes("911") ||
    /\bpsap\b/.test(hay) ||
    /\bdispatch\b/.test(hay) ||
    hay.includes("communications center") ||
    hay.includes("emergency communications")
  ) {
    return "rc911";
  }
  if (/\bcampus\b/.test(hay) || /\buniversity\b/.test(hay) || /\bcollege\b/.test(hay)) {
    return "campus";
  }
  if (/\btransit\b/.test(hay) || /\bmta\b/.test(hay) || /\bmarta\b/.test(hay)) {
    return "transit";
  }
  if (/\bhospital\b/.test(hay) || hay.includes("health system") || /\bhealthcare\b/.test(hay)) {
    return "hospital";
  }
  if (
    /\bvenue\b/.test(hay) ||
    /\barena\b/.test(hay) ||
    /\bstadium\b/.test(hay) ||
    hay.includes("convention center")
  ) {
    return "venue";
  }
  return "unknown";
}

/** Title keywords used when syncing Apollo people into a specific email-list vertical. */
export const APOLLO_VERTICAL_SEARCH_TITLES: Record<EmailListVertical, string[]> = {
  PSAP: [
    "PSAP Director",
    "911 Director",
    "Communications Director",
    "Emergency Communications Manager",
    "Public Safety Director",
  ],
  LAW_ENFORCEMENT: [
    "Chief of Police",
    "Sheriff",
    "Deputy Chief",
    "Captain",
    "Lieutenant",
    "Police IT Director",
    "Technology Director",
  ],
  FIRE_EMS: [
    "Fire Chief",
    "EMS Director",
    "Deputy Fire Chief",
    "Battalion Chief",
    "Fire Marshal",
  ],
  CAMPUS: [
    "Chief of Campus Safety",
    "Director of Public Safety",
    "Campus Security Director",
    "VP Campus Safety",
    "Dean of Students",
  ],
  VENUE: [
    "VP Security",
    "Director of Security",
    "Head of Security",
    "VP Operations",
    "General Manager",
  ],
  HOSPITAL: [
    "Chief Security Officer",
    "Director of Security",
    "VP Security",
    "Hospital Safety Officer",
    "Chief Safety Officer",
  ],
  TRANSIT: [
    "Chief of Transit Police",
    "Director of Transit Security",
    "VP Safety",
    "Director of Operations",
    "Transit Security Manager",
  ],
};

export function emailListVerticalLabel(vertical: EmailListVertical | "ALL"): string {
  switch (vertical) {
    case "PSAP":
      return "PSAP / 911";
    case "LAW_ENFORCEMENT":
      return "Law Enforcement";
    case "FIRE_EMS":
      return "Fire / EMS";
    case "CAMPUS":
      return "Campus";
    case "VENUE":
      return "Venue";
    case "HOSPITAL":
      return "Hospital";
    case "TRANSIT":
      return "Transit";
    case "ALL":
      return "All verticals";
    default:
      return vertical;
  }
}

import type { ContactRoleTier, RapidIqVertical } from "./types";

export type ContactRoleDefinition = {
  tier: ContactRoleTier;
  label: string;
  matchedOn: string;
};

export const CONTACT_ROLES_BY_VERTICAL: Record<RapidIqVertical, ContactRoleDefinition[]> = {
  "911": [
    { tier: "primary", label: "911 / ECC Director", matchedOn: "911 Director" },
    { tier: "executive", label: "County Commissioner", matchedOn: "Commissioner" },
    { tier: "procurement", label: "Procurement Officer", matchedOn: "Procurement" },
    { tier: "secondary", label: "IT / CAD Administrator", matchedOn: "CAD Admin" },
  ],
  campus: [
    { tier: "primary", label: "Chief of Police / Public Safety", matchedOn: "Chief of Police" },
    { tier: "executive", label: "VP Student Affairs", matchedOn: "Student Affairs" },
    { tier: "procurement", label: "Purchasing Director", matchedOn: "Purchasing" },
    { tier: "secondary", label: "Clery Compliance Officer", matchedOn: "Clery" },
  ],
  venue: [
    { tier: "primary", label: "Race Director", matchedOn: "Race Director" },
    { tier: "primary", label: "Event Director", matchedOn: "Event Director" },
    { tier: "primary", label: "Director of Operations", matchedOn: "Director of Operations" },
    { tier: "primary", label: "Director of Security", matchedOn: "Security Director" },
    { tier: "primary", label: "Medical Director", matchedOn: "Medical Director" },
    { tier: "secondary", label: "Course / Venue Manager", matchedOn: "Course Manager" },
    { tier: "secondary", label: "Volunteer Coordinator", matchedOn: "Volunteer Coordinator" },
    { tier: "secondary", label: "Guest Services Lead", matchedOn: "Guest Services" },
    { tier: "procurement", label: "Sponsorship / Partnerships Manager", matchedOn: "Sponsorships" },
    { tier: "procurement", label: "Operations Procurement", matchedOn: "Operations" },
    { tier: "executive", label: "Race Series Owner / CEO", matchedOn: "Race Series Owner" },
    { tier: "executive", label: "General Manager", matchedOn: "GM" },
  ],
};

export function personaChipsForVertical(vertical: RapidIqVertical): string[] {
  return CONTACT_ROLES_BY_VERTICAL[vertical].map((r) => r.matchedOn);
}

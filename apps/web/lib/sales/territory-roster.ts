import type { RoiVertical } from "rapid-cortex-shared";

export type TerritoryOwner = {
  email: string;
  name: string;
  /** US state codes (uppercase) */
  states: string[];
  verticals: RoiVertical[];
  phone?: string;
};

/**
 * Seed territory roster — who covers which states.
 * Update when contractors are assigned; later can move to Dynamo.
 */
export const TERRITORY_ROSTER: readonly TerritoryOwner[] = [
  {
    email: "east@nexcortiq.us",
    name: "East Region Desk",
    states: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD", "DC", "VA", "WV"],
    verticals: ["rc911", "campus", "venue", "hospital", "transit"],
  },
  {
    email: "southeast@nexcortiq.us",
    name: "Southeast Region Desk",
    states: ["NC", "SC", "GA", "FL", "AL", "MS", "TN", "KY"],
    verticals: ["rc911", "campus", "venue", "hospital", "transit"],
  },
  {
    email: "midwest@nexcortiq.us",
    name: "Midwest Region Desk",
    states: ["OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
    verticals: ["rc911", "campus", "venue", "hospital", "transit"],
  },
  {
    email: "southwest@nexcortiq.us",
    name: "Southwest Region Desk",
    states: ["TX", "OK", "AR", "LA", "NM", "AZ"],
    verticals: ["rc911", "campus", "venue", "hospital", "transit"],
  },
  {
    email: "west@nexcortiq.us",
    name: "West Region Desk",
    states: ["CA", "OR", "WA", "NV", "UT", "CO", "WY", "MT", "ID", "AK", "HI"],
    verticals: ["rc911", "campus", "venue", "hospital", "transit"],
  },
] as const;

export function ownersForState(state: string): TerritoryOwner[] {
  const s = state.trim().toUpperCase();
  return TERRITORY_ROSTER.filter((o) => o.states.includes(s));
}

export function ownersForEmail(email: string): TerritoryOwner | undefined {
  const e = email.trim().toLowerCase();
  return TERRITORY_ROSTER.find((o) => o.email.toLowerCase() === e);
}

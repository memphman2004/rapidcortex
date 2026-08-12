/** Client-side competitor helpers for Rapid IQ feed filtering. */

export const KNOWN_COMPETITORS = [
  "Axon",
  "Axon Enterprise",
  "Carbyne",
  "Prepared",
  "Motorola Solutions",
  "Motorola",
  "PremierOne",
  "CommandCentral",
  "VESTA",
  "Spillman",
  "Zetron",
  "Avigilon",
  "LiveSafe",
  "Exacom",
  "RapidSOS",
  "Rave Mobile Safety",
  "Rave Guardian",
  "Rave Alert",
  "Northern911",
  "CentralSquare",
  "Tyler Technologies",
  "New World CAD",
  "Hexagon",
  "Intergraph",
  "Mark43",
  "RapidDeploy",
  "Intrado",
  "West Technology",
  "Omnilert",
  "Navigate360",
  "Alertus",
  "Everbridge",
  "Omnigo",
  "ZeroEyes",
  "24/7 Software",
  "247 Software",
  "Raven Controls",
  "inOrbit",
  "Convergint",
  "Bandwidth",
  "Priority Dispatch",
  "NICE",
  "Verint",
] as const;

export function isKnownCompetitor(vendor: string | null | undefined): boolean {
  const v = vendor?.trim().toLowerCase() ?? "";
  if (!v) return false;
  return KNOWN_COMPETITORS.some((c) => v.includes(c.toLowerCase()));
}

export function isCompetitorOpportunity(opp: {
  incumbentVendor?: string | null;
  agencyType?: string | null;
  tags?: string[];
}): boolean {
  if (opp.agencyType === "competitor_watch") return true;
  if ((opp.tags ?? []).some((t) => t.toUpperCase() === "COMPETITOR")) return true;
  return isKnownCompetitor(opp.incumbentVendor);
}

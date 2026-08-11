/** Client-side competitor registry mirroring API list for feed filtering. */

export const KNOWN_COMPETITORS = [
  "Motorola Solutions",
  "CentralSquare",
  "Carbyne",
  "Axon",
  "RapidSOS",
  "Mark43",
  "Tyler Technologies",
  "Zetron",
  "Bandwidth",
  "Prepared",
  "Priority Dispatch",
  "NICE",
  "Verint",
  "Intrado",
  "West Technology",
] as const;

export function isKnownCompetitor(vendor: string | null | undefined): boolean {
  const v = vendor?.trim().toLowerCase() ?? "";
  if (!v) return false;
  return KNOWN_COMPETITORS.some((c) => v.includes(c.toLowerCase()));
}

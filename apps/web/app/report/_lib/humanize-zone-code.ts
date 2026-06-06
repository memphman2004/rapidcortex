export function humanizeZoneCode(zoneCode: string): string {
  const normalized = zoneCode.trim().toUpperCase();
  if (!normalized) return "";

  if (normalized === "FIELD") return "Field Level";

  const sectionMatch = normalized.match(/^S(\d{2,4})$/);
  if (sectionMatch) return `Section ${sectionMatch[1]}`;

  const gateMatch = normalized.match(/^G-?([A-Z])$/);
  if (gateMatch) return `Gate ${gateMatch[1]}`;

  const concourseMatch = normalized.match(/^C(\d+)$/);
  if (concourseMatch) return `Concourse ${concourseMatch[1]}`;

  return normalized
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

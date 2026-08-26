import type { VenueOperationalZone } from "rapid-cortex-shared";

const CX = 450;
const CY = 278;
const VENUE_ID = "MBS";

function ellipsePoint(rx: number, ry: number, angle: number): { x: number; y: number } {
  return { x: CX + rx * Math.cos(angle), y: CY + ry * Math.sin(angle) };
}

function sectionPath(
  innerRx: number,
  innerRy: number,
  outerRx: number,
  outerRy: number,
  a0: number,
  a1: number,
): string {
  const i0 = ellipsePoint(innerRx, innerRy, a0);
  const i1 = ellipsePoint(innerRx, innerRy, a1);
  const o1 = ellipsePoint(outerRx, outerRy, a1);
  const o0 = ellipsePoint(outerRx, outerRy, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${i0.x.toFixed(1)} ${i0.y.toFixed(1)} A ${innerRx} ${innerRy} 0 ${large} 1 ${i1.x.toFixed(1)} ${i1.y.toFixed(1)} L ${o1.x.toFixed(1)} ${o1.y.toFixed(1)} A ${outerRx} ${outerRy} 0 ${large} 0 ${o0.x.toFixed(1)} ${o0.y.toFixed(1)} Z`;
}

const SECTION_DEFS: Array<{ id: string; section: string; name: string; levelId: string }> = [
  { id: "section-101", section: "101", name: "Section 101", levelId: "level-1" },
  { id: "section-108", section: "108", name: "Section 108", levelId: "level-1" },
  { id: "section-124", section: "124", name: "Section 124", levelId: "level-2" },
  { id: "section-118", section: "118", name: "Section 118", levelId: "level-1" },
  { id: "section-210", section: "210", name: "Section 210", levelId: "club" },
  { id: "section-214", section: "214", name: "Section 214", levelId: "club" },
  { id: "section-301", section: "301", name: "Section 301", levelId: "upper" },
  { id: "section-308", section: "308", name: "Section 308", levelId: "upper" },
  { id: "section-c3", section: "C3", name: "Concourse 3", levelId: "level-1" },
  { id: "section-s124", section: "S124", name: "Section 124 Gate", levelId: "level-2" },
  { id: "gate-a", section: "G-A", name: "Gate A", levelId: "level-1" },
  { id: "gate-b", section: "G-B", name: "Gate B", levelId: "level-1" },
  { id: "gate-c", section: "G-C", name: "Gate C", levelId: "level-1" },
  { id: "gate-d", section: "G-D", name: "Gate D", levelId: "level-1" },
];

/** Illustrative bowl sections — not an architectural survey of any real stadium. */
export function buildDemoStadiumZones(): VenueOperationalZone[] {
  const start = -Math.PI / 2 - 0.18;
  const sweep = (Math.PI * 2) / SECTION_DEFS.length;
  const zones: VenueOperationalZone[] = [
    {
      id: "field",
      venueId: VENUE_ID,
      levelId: "field",
      name: "Field / Event Floor",
      type: "field",
      geometry: { kind: "ellipse", cx: CX, cy: CY, rx: 118, ry: 72 },
      status: "normal",
      labelX: CX,
      labelY: CY,
    },
    {
      id: "concourse-c",
      venueId: VENUE_ID,
      levelId: "level-2",
      name: "Concourse C",
      type: "concourse",
      geometry: { kind: "path", d: sectionPath(168, 108, 198, 128, 2.4, 3.6) },
      status: "incident",
      labelX: 178,
      labelY: 338,
    },
    {
      id: "concourse-b",
      venueId: VENUE_ID,
      levelId: "level-1",
      name: "Concourse B",
      type: "concourse",
      geometry: { kind: "path", d: sectionPath(168, 108, 198, 128, -0.4, 0.7) },
      status: "normal",
      labelX: 700,
      labelY: 250,
    },
    {
      id: "concourse-d",
      venueId: VENUE_ID,
      levelId: "level-1",
      name: "Concourse D",
      type: "concourse",
      geometry: { kind: "path", d: sectionPath(168, 108, 198, 128, 1.1, 2.2) },
      status: "normal",
      labelX: 450,
      labelY: 430,
    },
    {
      id: "club-level",
      venueId: VENUE_ID,
      levelId: "club",
      name: "Club Level",
      type: "suite",
      geometry: { kind: "path", d: sectionPath(200, 132, 228, 150, -2.6, -1.4) },
      status: "normal",
      labelX: 450,
      labelY: 118,
    },
    {
      id: "north-entrance",
      venueId: VENUE_ID,
      levelId: "level-1",
      name: "North Entrance",
      type: "operational",
      geometry: { kind: "rect", x: 392, y: 36, width: 116, height: 28, rx: 4 },
      status: "normal",
      labelX: 450,
      labelY: 50,
    },
    {
      id: "main-entrance",
      venueId: VENUE_ID,
      levelId: "level-1",
      name: "Main Entrance",
      type: "operational",
      geometry: { kind: "rect", x: 392, y: 488, width: 116, height: 28, rx: 4 },
      status: "normal",
      labelX: 450,
      labelY: 502,
    },
    {
      id: "restricted-ops",
      venueId: VENUE_ID,
      levelId: "level-1",
      name: "Restricted Ops",
      type: "restricted",
      geometry: { kind: "rect", x: 28, y: 236, width: 78, height: 52, rx: 4 },
      status: "normal",
      labelX: 67,
      labelY: 262,
    },
  ];

  SECTION_DEFS.forEach((def, i) => {
    const a0 = start + i * sweep;
    const a1 = a0 + sweep * 0.92;
    const mid = (a0 + a1) / 2;
    const label = ellipsePoint(155, 98, mid);
    const inner = def.levelId === "upper" ? [148, 92, 188, 122] : [128, 80, 168, 108];
    zones.push({
      id: def.id,
      venueId: VENUE_ID,
      levelId: def.levelId,
      name: def.name,
      type: def.id.startsWith("gate") ? "operational" : "section",
      section: def.section,
      geometry: {
        kind: "path",
        d: sectionPath(inner[0]!, inner[1]!, inner[2]!, inner[3]!, a0, a1),
      },
      status: def.id === "section-124" ? "incident" : "normal",
      labelX: label.x,
      labelY: label.y,
    });
  });

  return zones;
}

export const STADIUM_VIEWBOX = { width: 900, height: 560, cx: CX, cy: CY };

import type {
  ExteriorLayerId,
  FacilityLayerId,
  VenueAssetType,
  VenueEntranceKind,
  VenueOperationalAsset,
  VenueOperationalMap,
} from "rapid-cortex-shared";
import type { RCOperationalOverlay } from "@/components/maps/map-types";

export const FACILITY_LAYER_LABELS: Record<FacilityLayerId, string> = {
  incidents: "Incidents",
  security: "Security Staff",
  medical: "Medical / AED",
  cameras: "Cameras",
  entrances: "Entrances",
  exits: "Emergency Exits",
  stairs: "Stairs",
  elevators: "Elevators",
  escalators: "Escalators",
  restricted: "Restricted Areas",
  qrZones: "QR/NFC Reporting Zones",
  guestServices: "Guest Services",
  fireSafety: "Fire Safety",
  operationalZones: "Operational Zones",
};

export const EXTERIOR_LAYER_LABELS: Record<ExteriorLayerId, string> = {
  incidents: "Incidents",
  security: "Security",
  ems: "EMS",
  police: "Police",
  fire: "Fire",
  cameras: "Cameras",
  entrances: "Entrances",
  staging: "Staging",
  roadClosures: "Road Closures",
};

export const FACILITY_MARKER_COLORS: Record<string, string> = {
  camera: "#3b82f6",
  incident: "#ef4444",
  aed: "#a78bfa",
  firstAid: "#a78bfa",
  security: "#22c55e",
  entrance: "#22c55e",
  exit: "#f97316",
  stairs: "#f59e0b",
  escalator: "#f59e0b",
  elevator: "#38bdf8",
  fireExtinguisher: "#fb7185",
  qrZone: "#94a3b8",
};

export function assetTypeToFacilityLayer(type: VenueAssetType): FacilityLayerId {
  switch (type) {
    case "camera":
      return "cameras";
    case "aed":
    case "firstAid":
      return "medical";
    case "security":
      return "security";
    case "elevator":
      return "elevators";
    case "escalator":
      return "escalators";
    case "stairs":
      return "stairs";
    case "exit":
      return "exits";
    case "entrance":
      return "entrances";
    case "fireExtinguisher":
      return "fireSafety";
    case "qrZone":
      return "qrZones";
  }
}

export function assetTypeToExteriorLayer(
  type: VenueAssetType,
): ExteriorLayerId | null {
  switch (type) {
    case "camera":
      return "cameras";
    case "security":
      return "security";
    case "firstAid":
    case "aed":
      return "ems";
    case "entrance":
      return "entrances";
    default:
      return null;
  }
}

export function entranceKindToExteriorLayer(kind: VenueEntranceKind): ExteriorLayerId {
  return kind === "emergency" ? "staging" : "entrances";
}

export function overlayKindForAsset(asset: VenueOperationalAsset): RCOperationalOverlay["kind"] | null {
  switch (asset.type) {
    case "camera":
      return "camera";
    case "security":
      return "security";
    case "firstAid":
    case "aed":
      return "ems";
    case "entrance":
      return "entrance";
    default:
      return null;
  }
}

export function buildExteriorOverlays(
  map: VenueOperationalMap,
  visible: ReadonlySet<string>,
): RCOperationalOverlay[] {
  const overlays: RCOperationalOverlay[] = [];
  for (const asset of map.assets) {
    const coords = asset.exteriorCoordinates;
    if (!coords) continue;
    const layer = assetTypeToExteriorLayer(asset.type);
    if (!layer || !visible.has(layer)) continue;
    const kind = overlayKindForAsset(asset);
    if (!kind) continue;
    overlays.push({
      id: asset.id,
      longitude: coords[0],
      latitude: coords[1],
      kind,
      label: asset.name,
    });
  }
  for (const entrance of map.entrances) {
    const coords = entrance.exteriorCoordinates;
    if (!coords) continue;
    const layer = entranceKindToExteriorLayer(entrance.kind);
    if (!visible.has(layer)) continue;
    overlays.push({
      id: entrance.id,
      longitude: coords[0],
      latitude: coords[1],
      kind: entrance.kind === "emergency" ? "staging" : "entrance",
      label: entrance.name,
    });
  }
  return overlays;
}

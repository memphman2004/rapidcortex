/**
 * Classes a Custom Labels model must learn before it can replace DetectLabels.
 * A class name on this list is not a trained detector.
 */
import type {
  DetectionCategory,
  ObservationConfidence,
  VisionSceneEventType,
  VisionSceneSeverity,
} from "./types.js";

export type SceneTrainingClass = {
  id: string;
  /** Label written into a Rekognition Custom Labels manifest. */
  label: string;
  name: string;
  eventType: VisionSceneEventType;
  category: DetectionCategory;
  severity: VisionSceneSeverity;
  confidence: ObservationConfidence;
  shortLabel: string;
  minPositives: number;
  minNegatives: number;
  media: "image" | "video";
};

export const SCENE_TRAINING_CLASSES: readonly SceneTrainingClass[] = [
  {
    id: "firearm_like",
    label: "nexcort-firearm-like",
    name: "Firearm-like object",
    eventType: "VISIBLE_WEAPON",
    category: "POTENTIAL_WEAPON",
    severity: "high",
    confidence: "LOW",
    shortLabel: "Possible weapon",
    minPositives: 40,
    minNegatives: 40,
    media: "image",
  },
  {
    id: "blade_like",
    label: "nexcort-blade-like",
    name: "Knife or blade-like object",
    eventType: "VISIBLE_WEAPON",
    category: "POTENTIAL_WEAPON",
    severity: "high",
    confidence: "LOW",
    shortLabel: "Possible weapon",
    minPositives: 40,
    minNegatives: 40,
    media: "image",
  },
  {
    id: "altercation",
    label: "nexcort-altercation",
    name: "Physical altercation",
    eventType: "FIGHT_OR_ALTERCATION",
    category: "FIGHT_OR_ALTERCATION",
    severity: "critical",
    confidence: "MEDIUM",
    shortLabel: "Physical altercation",
    minPositives: 30,
    minNegatives: 30,
    media: "video",
  },
  {
    id: "person_down",
    label: "nexcort-person-down",
    name: "Person down or fall",
    eventType: "PERSON_DOWN",
    category: "PERSON_DOWN",
    severity: "critical",
    confidence: "MEDIUM",
    shortLabel: "Person on ground",
    minPositives: 30,
    minNegatives: 20,
    media: "video",
  },
  {
    id: "forced_entry",
    label: "nexcort-forced-entry",
    name: "Forced-entry indicators",
    eventType: "FORCED_ENTRY",
    category: "RESTRICTED_AREA_ENTRY",
    severity: "high",
    confidence: "LOW",
    shortLabel: "Forced entry",
    minPositives: 30,
    minNegatives: 20,
    media: "video",
  },
  {
    id: "vehicle_collision",
    label: "nexcort-vehicle-collision",
    name: "Vehicle collision",
    eventType: "VEHICLE_COLLISION",
    category: "VEHICLE",
    severity: "high",
    confidence: "MEDIUM",
    shortLabel: "Vehicle collision",
    minPositives: 30,
    minNegatives: 20,
    media: "video",
  },
];

const BY_TOKEN = new Map<string, SceneTrainingClass>();
for (const item of SCENE_TRAINING_CLASSES) {
  BY_TOKEN.set(item.id, item);
  BY_TOKEN.set(item.label, item);
  BY_TOKEN.set(item.name.toLowerCase(), item);
}

/** Match a Custom Labels hit. Generic Rekognition names stay on the other path. */
export function sceneTrainingClassForLabel(name: string): SceneTrainingClass | null {
  const token = name.trim().toLowerCase();
  return BY_TOKEN.get(token) ?? null;
}

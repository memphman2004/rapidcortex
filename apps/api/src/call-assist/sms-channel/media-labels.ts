/** Map Rekognition scene labels to a Call Assist / 311 issue hint. */

export function inferCategoryFromSceneLabels(sceneLabels: string[]): string | null {
  const labels = new Set(sceneLabels.map((l) => l.toLowerCase()));

  if (labels.has("pothole") || labels.has("asphalt") || (labels.has("road") && labels.has("damage"))) {
    return "POTHOLE";
  }
  if (labels.has("graffiti") || labels.has("vandalism") || labels.has("spray paint")) {
    return "GRAFFITI_PUBLIC_BUILDING";
  }
  if (labels.has("trash") || labels.has("garbage") || labels.has("waste")) {
    return "ILLEGAL_DUMPING";
  }
  if (labels.has("flood") || (labels.has("water") && labels.has("road"))) {
    return "STREET_FLOODING";
  }
  if (labels.has("tree") && (labels.has("fallen") || labels.has("broken") || labels.has("road"))) {
    return "FALLEN_TREE_ROAD";
  }
  if (labels.has("car") && (labels.has("abandoned") || labels.has("wreck"))) {
    return "ABANDONED_VEHICLE_STREET";
  }
  if (labels.has("fire") || labels.has("smoke") || labels.has("flame")) {
    return null;
  }
  return null;
}

import type { GeoBox, HubIncident, TransferRule } from "./types";

function inBox(lat: number | undefined, lon: number | undefined, box: GeoBox | undefined): boolean {
  if (!box) return true;
  if (lat === undefined || lon === undefined) return false;
  return lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon;
}

export function matchTransferRules(incident: HubIncident, rules: TransferRule[]): TransferRule[] {
  return rules.filter((rule) => {
    if (!rule.enabled) return false;
    if (rule.sourceAgencyId !== incident.sourceAgencyId) return false;
    if (rule.incidentTypeCodes.length > 0 && !rule.incidentTypeCodes.includes(incident.commonIncidentTypeCode)) {
      return false;
    }
    return inBox(incident.latitude, incident.longitude, rule.geoBox);
  });
}

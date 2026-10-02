import {
  addressConfidenceFromGeocode,
  assignCallAssistZone,
  jurisdictionHint,
  type CallAssistGisZone,
  type CallIntakeData,
} from "rapid-cortex-shared";
import { geocodeAddress } from "../location/geocoding.js";

export async function enrichIntakeWithGis(opts: {
  intake: CallIntakeData;
  zones?: CallAssistGisZone[] | null;
  tenantCity?: string | null;
  tenantState?: string | null;
}): Promise<CallIntakeData> {
  const text = opts.intake.locationText?.trim();
  if (!text) return opts.intake;
  if (opts.intake.locationLat != null && opts.intake.locationLng != null && opts.intake.addressConfidence != null) {
    return applyZone(opts.intake, opts.zones, opts.tenantCity, opts.tenantState);
  }
  try {
    const hits = await geocodeAddress(text, { maxResults: 1 });
    const top = hits[0];
    if (!top) {
      return {
        ...opts.intake,
        addressConfidence: addressConfidenceFromGeocode({
          locationSource: opts.intake.locationSource,
          hasText: true,
        }),
      };
    }
    const next: CallIntakeData = {
      ...opts.intake,
      locationLat: top.latitude,
      locationLng: top.longitude,
      addressConfidence: addressConfidenceFromGeocode({
        geocodeConfidence: top.confidence,
        locationSource: "GIS",
        hasText: true,
      }),
      locationSource: opts.intake.locationSource === "ANI_ALI" || opts.intake.locationSource === "RAPIDSOS"
        ? opts.intake.locationSource
        : "GIS",
    };
    return applyZone(next, opts.zones, opts.tenantCity ?? top.city, opts.tenantState ?? top.state, top.city, top.state);
  } catch {
    return {
      ...opts.intake,
      addressConfidence: addressConfidenceFromGeocode({
        locationSource: opts.intake.locationSource,
        hasText: true,
      }),
    };
  }
}

function applyZone(
  intake: CallIntakeData,
  zones?: CallAssistGisZone[] | null,
  tenantCity?: string | null,
  tenantState?: string | null,
  city?: string | null,
  state?: string | null,
): CallIntakeData {
  const lng = intake.locationLng;
  const lat = intake.locationLat;
  const zone =
    lng != null && lat != null ? assignCallAssistZone(lng, lat, zones) : null;
  const hint = jurisdictionHint({
    city,
    state,
    tenantCity,
    tenantState,
  });
  return {
    ...intake,
    zoneId: zone?.zoneId ?? intake.zoneId,
    zoneName: zone?.zoneName ?? intake.zoneName,
    jurisdictionMatch: hint.match,
    jurisdictionLabel: hint.label || intake.jurisdictionLabel,
  };
}

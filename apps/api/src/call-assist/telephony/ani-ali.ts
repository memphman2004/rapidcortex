import type { CallIntakeData } from "rapid-cortex-shared";

export type ConnectCallerIdentity = {
  ani?: string;
  aliAddress?: string;
  apartmentSuite?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  locationSource: CallIntakeData["locationSource"];
};

function attr(attributes: Record<string, string> | undefined, keys: string[]): string | undefined {
  if (!attributes) return undefined;
  const lower = new Map(Object.entries(attributes).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const v = attributes[key]?.trim() || lower.get(key.toLowerCase())?.trim();
    if (v) return v;
  }
  return undefined;
}

/**
 * Amazon Connect is the live telephony path. ANI is the customer endpoint.
 * ALI, when present, arrives as contact attributes from the Connect flow,
 * RapidSOS, or a PSAP ALI lookup Lambda — Rapid Cortex does not host a 911 ALI database.
 */
export function ingestConnectCallerIdentity(opts: {
  ani?: string;
  attributes?: Record<string, string>;
}): ConnectCallerIdentity {
  const ani =
    opts.ani?.trim() ||
    attr(opts.attributes, [
      "CustomerEndpoint.Address",
      "CustomerNumber",
      "ANI",
      "ani",
      "CallingNumber",
    ]);
  const street = attr(opts.attributes, [
    "ALI",
    "AliAddress",
    "ALIAddress",
    "StreetAddress",
    "Address",
    "RapidSOS.address",
    "RapidSOSAddress",
    "Location",
  ]);
  const apartmentSuite = attr(opts.attributes, ["Apartment", "Apt", "Unit", "ALIUnit", "Suite"]);
  const city = attr(opts.attributes, ["City", "ALICity"]);
  const state = attr(opts.attributes, ["State", "ALIState"]);
  const postalCode = attr(opts.attributes, ["Zip", "PostalCode", "ALIZip"]);
  const aliAddress = [street, apartmentSuite ? `Apt ${apartmentSuite}` : "", city, state, postalCode]
    .filter(Boolean)
    .join(", ");
  return {
    ani,
    aliAddress: aliAddress || undefined,
    apartmentSuite,
    city,
    state,
    postalCode,
    locationSource: street ? "ANI_ALI" : ani ? "UNKNOWN" : undefined,
  };
}

export function intakeFromCallerIdentity(
  identity: ConnectCallerIdentity,
  prior: CallIntakeData = {},
): CallIntakeData {
  const next: CallIntakeData = { ...prior };
  if (identity.aliAddress && !next.locationText) {
    next.locationText = identity.aliAddress;
    next.locationSource = "ANI_ALI";
  }
  if (identity.apartmentSuite && !next.apartmentSuite) next.apartmentSuite = identity.apartmentSuite;
  if (identity.ani && !next.callbackNumber) next.callbackNumber = identity.ani;
  return next;
}

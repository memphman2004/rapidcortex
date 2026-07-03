/**
 * cap-parser.ts
 *
 * CAP 1.2 XML parser — zero external dependencies.
 *
 * Design: structured extraction against the well-known CAP 1.2 schema.
 * No generic XML library needed — CAP has a fixed, known structure that
 * we can parse reliably with careful string operations.
 *
 * Handles:
 *   - Multiple <info> blocks (pick English first, fall back to first)
 *   - Multiple <area> and <geocode> blocks per info
 *   - Multiple <category>, <responseType> per info
 *   - IPAWS profile extensions (SAME codes, UGC codes)
 *   - Namespace prefixes (cap:alert, urn:oasis: variants)
 *   - CDATA sections in description/instruction
 *   - UTF-8 encoding declarations
 *   - CAP Update/Cancel <references> parsing
 *   - Polygon centroid calculation for lat/lng
 *
 * What it does NOT handle (out of scope for Phase 4):
 *   - Digital signatures (CAP <Signature> element — IPAWS signed alerts)
 *   - Atom feed wrapping (handled upstream — feed parser strips Atom envelope)
 *   - CAP 1.1 (very rare, different namespace)
 */

import type {
  CapAlert,
  CapArea,
  CapCategory,
  CapCertainty,
  CapGeocode,
  CapInfo,
  CapMsgType,
  CapResource,
  CapResponseType,
  CapScope,
  CapSeverity,
  CapStatus,
  CapUrgency,
  NormalizedCapIncident,
} from "./cap-types.js";
import { capToPriority } from "./cap-types.js";

// ─── XML string utilities ─────────────────────────────────────────────────────

/**
 * Extract the text content of the FIRST occurrence of a tag (any namespace prefix).
 * Handles <tag>value</tag>, <ns:tag>value</ns:tag>, and CDATA <![CDATA[value]]>.
 */
function getFirst(xml: string, localName: string): string | undefined {
  // Match both namespaced and non-namespaced variants
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_.-]+:)?${localName}>`,
    "i",
  );
  const m = xml.match(pattern);
  if (!m) return undefined;
  return decodeCdata(m[1].trim());
}

/** Extract all occurrences of a tag's text content */
function getAll(xml: string, localName: string): string[] {
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_.-]+:)?${localName}>`,
    "gi",
  );
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(xml)) !== null) {
    const val = decodeCdata(m[1].trim());
    if (val) results.push(val);
  }
  return results;
}

/** Extract all occurrences of an element block (for complex children) */
function getBlocks(xml: string, localName: string): string[] {
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_.-]+:)?${localName}>`,
    "gi",
  );
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/** Strip CDATA wrappers and decode XML entities */
function decodeCdata(s: string): string {
  // Strip CDATA: <![CDATA[...]]>
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Decode common XML entities
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/** Coerce a string to a known enum value, return undefined if not recognized */
function coerce<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  const normalized = value.trim() as T;
  return (allowed as readonly string[]).includes(normalized) ? normalized : undefined;
}

// ─── Geocode extraction ────────────────────────────────────────────────────────

function parseGeocodes(areaXml: string): CapGeocode[] {
  const geocodes: CapGeocode[] = [];
  const geocodeBlocks = getBlocks(areaXml, "geocode");
  for (const block of geocodeBlocks) {
    const valueName = getFirst(block, "valueName");
    const value = getFirst(block, "value");
    if (valueName && value) {
      geocodes.push({ valueName, value });
    }
  }
  return geocodes;
}

/** Extract FIPS6 codes from all area geocode blocks in all info blocks */
export function extractFipsCodes(infos: CapInfo[]): string[] {
  const fips = new Set<string>();
  for (const info of infos) {
    for (const area of info.areas) {
      for (const geo of area.geocodes) {
        // FIPS6 and FIPS6 variant names used by different systems
        if (
          geo.valueName === "FIPS6" ||
          geo.valueName === "FIPS" ||
          geo.valueName === "SAME"
        ) {
          // Normalize: strip leading zeros variations, ensure 6 digits
          const raw = geo.value.replace(/\D/g, "");
          if (raw.length >= 5) {
            // FIPS6 is county = state(2) + county(3) → 5 digits is valid state+county
            // SAME codes are 7 digits (0FIPS6) — strip leading zero
            const normalized = raw.length === 7 && raw.startsWith("0")
              ? raw.slice(1)
              : raw;
            fips.add(normalized.padStart(6, "0").slice(0, 6));
          }
        }
      }
    }
  }
  return [...fips];
}

// ─── Area parser ──────────────────────────────────────────────────────────────

function parseArea(areaXml: string): CapArea {
  return {
    areaDesc: getFirst(areaXml, "areaDesc") ?? "",
    polygon: getFirst(areaXml, "polygon"),
    circle: getFirst(areaXml, "circle"),
    geocodes: parseGeocodes(areaXml),
  };
}

// ─── Polygon centroid ─────────────────────────────────────────────────────────

/**
 * Compute the centroid of a CAP polygon string.
 * CAP polygons are space-delimited "lat,lon" pairs.
 * Returns [lat, lng] or undefined if polygon is malformed.
 */
export function polygonCentroid(polygon: string): [number, number] | undefined {
  const pairs = polygon.trim().split(/\s+/);
  const points: [number, number][] = [];
  for (const pair of pairs) {
    const [latStr, lngStr] = pair.split(",");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) points.push([lat, lng]);
  }
  if (points.length === 0) return undefined;
  const sumLat = points.reduce((s, p) => s + p[0], 0);
  const sumLng = points.reduce((s, p) => s + p[1], 0);
  return [sumLat / points.length, sumLng / points.length];
}

// ─── Info block parser ────────────────────────────────────────────────────────

const CAP_CATEGORIES = [
  "Geo", "Met", "Safety", "Security", "Rescue",
  "Fire", "Health", "Env", "Transport", "Infra", "CBRNE", "Other",
] as const;

const CAP_URGENCIES = ["Immediate", "Expected", "Future", "Past", "Unknown"] as const;
const CAP_SEVERITIES = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"] as const;
const CAP_CERTAINTIES = ["Observed", "Likely", "Possible", "Unlikely", "Unknown"] as const;
const CAP_RESPONSE_TYPES = [
  "Shelter", "Evacuate", "Prepare", "Execute", "Avoid",
  "Monitor", "Assess", "AllClear", "None",
] as const;

function parseInfo(infoXml: string): CapInfo {
  const categories = getAll(infoXml, "category")
    .map((c) => coerce(c, CAP_CATEGORIES))
    .filter((c): c is CapCategory => c !== undefined);

  const responseTypes = getAll(infoXml, "responseType")
    .map((r) => coerce(r, CAP_RESPONSE_TYPES))
    .filter((r): r is CapResponseType => r !== undefined);

  const areaBlocks = getBlocks(infoXml, "area").map(parseArea);
  const resourceBlocks = getBlocks(infoXml, "resource");

  // Parse <parameter> name→value pairs
  const parameters: Record<string, string> = {};
  const paramBlocks = getBlocks(infoXml, "parameter");
  for (const block of paramBlocks) {
    const name = getFirst(block, "valueName");
    const value = getFirst(block, "value");
    if (name && value) parameters[name] = value;
  }

  return {
    language: getFirst(infoXml, "language"),
    categories: categories.length > 0 ? categories : ["Other"],
    event: getFirst(infoXml, "event") ?? "Unknown",
    responseTypes,
    urgency: coerce(getFirst(infoXml, "urgency"), CAP_URGENCIES) ?? "Unknown",
    severity: coerce(getFirst(infoXml, "severity"), CAP_SEVERITIES) ?? "Unknown",
    certainty: coerce(getFirst(infoXml, "certainty"), CAP_CERTAINTIES) ?? "Unknown",
    audience: getFirst(infoXml, "audience"),
    effective: getFirst(infoXml, "effective"),
    onset: getFirst(infoXml, "onset"),
    expires: getFirst(infoXml, "expires"),
    senderName: getFirst(infoXml, "senderName"),
    headline: getFirst(infoXml, "headline"),
    description: getFirst(infoXml, "description"),
    instruction: getFirst(infoXml, "instruction"),
    web: getFirst(infoXml, "web"),
    contact: getFirst(infoXml, "contact"),
    areas: areaBlocks,
    resources: resourceBlocks.map(
      (r): CapResource => ({
        resourceDesc: getFirst(r, "resourceDesc") ?? "",
        mimeType: getFirst(r, "mimeType") ?? "application/octet-stream",
        uri: getFirst(r, "uri"),
      }),
    ),
    parameters,
  };
}

// ─── Alert parser ─────────────────────────────────────────────────────────────

const CAP_STATUSES = ["Actual", "Exercise", "System", "Test", "Draft"] as const;
const CAP_MSG_TYPES = ["Alert", "Update", "Cancel", "Ack", "Error"] as const;
const CAP_SCOPES = ["Public", "Restricted", "Private"] as const;

export type ParseResult =
  | { ok: true; alert: CapAlert }
  | { ok: false; error: string; rawXml: string };

export function parseCapXml(rawXml: string): ParseResult {
  // Verify this looks like a CAP document
  if (!rawXml.includes("urn:oasis:names:tc:emergency:cap") && !rawXml.includes("<alert")) {
    return { ok: false, error: "Not a CAP document — missing CAP namespace or <alert> element", rawXml };
  }

  const identifier = getFirst(rawXml, "identifier");
  const sender = getFirst(rawXml, "sender");
  const sent = getFirst(rawXml, "sent");

  if (!identifier) return { ok: false, error: "Missing required <identifier>", rawXml };
  if (!sender) return { ok: false, error: "Missing required <sender>", rawXml };
  if (!sent) return { ok: false, error: "Missing required <sent>", rawXml };

  const statusRaw = getFirst(rawXml, "status");
  const status = coerce(statusRaw, CAP_STATUSES);
  if (!status) return { ok: false, error: `Unknown <status>: ${statusRaw}`, rawXml };

  const msgTypeRaw = getFirst(rawXml, "msgType");
  const msgType = coerce(msgTypeRaw, CAP_MSG_TYPES);
  if (!msgType) return { ok: false, error: `Unknown <msgType>: ${msgTypeRaw}`, rawXml };

  const scopeRaw = getFirst(rawXml, "scope");
  const scope = coerce(scopeRaw, CAP_SCOPES) ?? "Public";

  // Parse all <info> blocks
  const infoBlocks = getBlocks(rawXml, "info");
  const infos = infoBlocks.map(parseInfo);

  const alert: CapAlert = {
    identifier,
    sender,
    sent,
    status,
    msgType,
    source: getFirst(rawXml, "source"),
    scope,
    restriction: getFirst(rawXml, "restriction"),
    addresses: getFirst(rawXml, "addresses"),
    codes: getAll(rawXml, "code"),
    note: getFirst(rawXml, "note"),
    references: getFirst(rawXml, "references"),
    incidents: getFirst(rawXml, "incidents"),
    infos,
    rawXml,
  };

  return { ok: true, alert };
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a parsed CapAlert to the RC incident shape.
 * Picks the English <info> block if multiple languages are present.
 */
export function normalizeCapAlert(
  alert: CapAlert,
  source: "cap_direct" | "ipaws_feed" = "cap_direct",
): NormalizedCapIncident {
  // Pick primary info block: prefer English, fall back to first
  const primaryInfo =
    alert.infos.find((i) => !i.language || i.language.startsWith("en")) ??
    alert.infos[0];

  const urgency = primaryInfo?.urgency ?? "Unknown";
  const severity = primaryInfo?.severity ?? "Unknown";
  const priority = capToPriority(urgency, severity);

  const fipsCodes = extractFipsCodes(alert.infos);

  // Get coordinates from polygon if available
  let latitude: number | undefined;
  let longitude: number | undefined;
  let polygon: string | undefined;
  if (primaryInfo) {
    for (const area of primaryInfo.areas) {
      if (area.polygon) {
        polygon = area.polygon;
        const centroid = polygonCentroid(area.polygon);
        if (centroid) {
          [latitude, longitude] = centroid;
          break;
        }
      }
    }
  }

  // Parse <references> into individual identifiers for Update/Cancel linking
  // Format: "sender,identifier,sent sender2,identifier2,sent2 ..."
  const updatesIdentifiers: string[] = [];
  if (alert.references) {
    const triplets = alert.references.trim().split(/\s+/);
    for (const triplet of triplets) {
      const parts = triplet.split(",");
      if (parts.length >= 2) {
        updatesIdentifiers.push(parts[1]); // identifier is the second field
      }
    }
  }

  return {
    capIdentifier: alert.identifier,
    capSender: alert.sender,
    capSentAt: alert.sent,
    fipsCodes,
    incidentType: primaryInfo?.event ?? "CAP Alert",
    category: primaryInfo?.categories[0] ?? "Other",
    priority,
    headline: primaryInfo?.headline ?? primaryInfo?.event ?? alert.identifier,
    description: primaryInfo?.description,
    instruction: primaryInfo?.instruction,
    areaDesc: primaryInfo?.areas[0]?.areaDesc ?? "",
    polygon,
    latitude,
    longitude,
    effective: primaryInfo?.effective,
    onset: primaryInfo?.onset,
    expires: primaryInfo?.expires,
    msgType: alert.msgType,
    updatesIdentifiers,
    severity,
    urgency,
    certainty: primaryInfo?.certainty ?? "Unknown",
    responseTypes: primaryInfo?.responseTypes ?? [],
    source,
    receivedAt: new Date().toISOString(),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface CapValidationResult {
  shouldProcess: boolean;
  skipReason?: string;
}

/**
 * Determine if a parsed alert should be processed given agency config.
 * Returns shouldProcess=false with a reason for any skip condition.
 */
export function shouldProcessAlert(
  alert: CapAlert,
  opts: { acceptExercise?: boolean; acceptTest?: boolean },
): CapValidationResult {
  if (alert.status === "System") {
    return { shouldProcess: false, skipReason: "status=System — not actionable" };
  }
  if (alert.status === "Draft") {
    return { shouldProcess: false, skipReason: "status=Draft — not finalized" };
  }
  if (alert.status === "Test" && !opts.acceptTest) {
    return { shouldProcess: false, skipReason: "status=Test — acceptTest not enabled" };
  }
  if (alert.status === "Exercise" && !opts.acceptExercise) {
    return { shouldProcess: false, skipReason: "status=Exercise — acceptExercise not enabled" };
  }
  if (alert.msgType === "Ack") {
    return { shouldProcess: false, skipReason: "msgType=Ack — acknowledgment only" };
  }
  if (alert.msgType === "Error") {
    return { shouldProcess: false, skipReason: "msgType=Error — sender reporting error" };
  }
  if (alert.infos.length === 0) {
    return { shouldProcess: false, skipReason: "No <info> blocks — alert has no actionable data" };
  }
  return { shouldProcess: true };
}

import { XMLParser } from "fast-xml-parser";
import type { CadAlert, CadAniAliSource, CadLocationSource, CadUnitAssignment } from "rapid-cortex-shared";
import type { NormalizedCadIncident } from "../types.js";

export function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const LIST_KEYS = [
  "incidents",
  "Incidents",
  "events",
  "Events",
  "data",
  "results",
  "Results",
  "EventList",
  "Records",
  "value",
  "Items",
  "Calls",
  "calls",
  "Notifications",
  "IncidentList",
  "eventList",
  "CallEvents",
];

const WRAP_KEYS = [
  "payload",
  "event",
  "incident",
  "Incident",
  "CallEvent",
  "IncidentNotification",
  "Event",
  "Call",
  "Notification",
  "body",
  "Body",
  "d",
  "data",
];

const ID_KEY_LOOKUP = new Set(
  [
    "IncidentNumber",
    "incidentNumber",
    "IncidentId",
    "incidentId",
    "incident_id",
    "EventId",
    "EventID",
    "eventId",
    "event_id",
    "EventNumber",
    "eventNumber",
    "CallNumber",
    "callNumber",
    "call_number",
    "CallId",
    "callId",
    "id",
    "cadNumber",
    "CADNumber",
    "CaseNumber",
    "displayId",
    "CADEventID",
    "cadEventId",
  ].map((k) => k.toLowerCase()),
);

export function pickFirst(record: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(record)) lower.set(k.toLowerCase(), v);
  for (const key of keys) {
    const direct = record[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") return direct;
    const folded = lower.get(key.toLowerCase());
    if (folded !== undefined && folded !== null && String(folded).trim() !== "") return folded;
  }
  return undefined;
}

export function pickFirstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  const v = pickFirst(record, keys);
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

export function normalizeCadPriority(v: unknown): NormalizedCadIncident["priority"] {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  if (n === 1) return "P1";
  if (n === 2) return "P2";
  if (n === 4) return "P4";
  if (n === 5) return "P4";
  if (n === 3) return "P3";

  const s = String(v ?? "P3").trim().toUpperCase();
  if (s === "P1" || s === "P2" || s === "P3" || s === "P4") return s;
  if (s === "E" || s === "EMERGENCY" || s === "IMMEDIATE" || s === "CRITICAL") return "P1";
  if (s === "HIGH" || s === "PRIORITY" || s === "URGENT") return "P2";
  if (s === "LOW" || s === "NON-EMERGENCY" || s === "NONEMERGENCY") return "P4";
  if (s === "MEDIUM" || s === "ROUTINE") return "P3";
  return "P3";
}

export function parseCadUnits(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string" && v.trim()) return v.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(v)) {
    return v
      .flatMap((item) => {
        if (typeof item === "string") return [item];
        const rec = asRecord(item);
        if (!rec) return [];
        const id = pickFirstString(rec, ["UnitId", "unitId", "unit_id", "Unit", "id", "Code", "UnitCode"]);
        return id ? [id] : [];
      })
      .filter(Boolean);
  }
  const rec = asRecord(v);
  if (!rec) return [];
  const nested = rec.Unit ?? rec.Units ?? rec.unit ?? rec.units ?? rec.UnitList;
  if (nested !== undefined) return parseCadUnits(nested);
  const id = pickFirstString(rec, ["UnitId", "unitId", "unit_id", "id"]);
  return id ? [id] : [];
}

export function parseCadRevision(record: Record<string, unknown>, keys: string[]): number | undefined {
  const raw = pickFirst(record, keys);
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function parseCadCoordinates(record: Record<string, unknown>): { lat: number; lng: number } | undefined {
  const nested =
    asRecord(record.Location) ??
    asRecord(record.location) ??
    asRecord(record.coordinates) ??
    asRecord(record.Coordinates) ??
    asRecord(record.GPS) ??
    asRecord(record.gps) ??
    asRecord(record.Geo) ??
    null;
  const sources = nested ? [nested, record] : [record];
  for (const src of sources) {
    const latRaw = pickFirst(src, ["Latitude", "Lat", "gpsLat", "lat", "YCoord", "GeoLat"]);
    const lngRaw = pickFirst(src, ["Longitude", "Lon", "Lng", "gpsLon", "lng", "long", "XCoord", "GeoLon"]);
    const lat = typeof latRaw === "number" ? latRaw : Number.parseFloat(String(latRaw ?? ""));
    const lng = typeof lngRaw === "number" ? lngRaw : Number.parseFloat(String(lngRaw ?? ""));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    return { lat, lng };
  }
  return undefined;
}

const BEAT_KEYS = ["Beat", "BeatId", "BeatNumber", "PatrolBeat", "District", "UnitBeat"];
const ZONE_KEYS = ["Zone", "ResponseZone", "FireZone", "PoliceZone", "AlarmZone"];
const INTERSECTION_KEYS = ["Intersection", "CrossStreet", "CrossStreets", "CrossStreetName"];
const JURISDICTION_KEYS = ["Jurisdiction", "RespondingAgency", "PSAP", "AgencyName"];
const LOCATION_CONFIDENCE_KEYS = ["LocationConfidence", "GeocodeConfidence", "AddrConfidence", "AddressConfidence"];
const LOCATION_SOURCE_KEYS = ["LocationSource", "AddressSource", "GeoSource", "ALISource"];
const DISPOSITION_KEYS = ["DispositionCode", "CloseCode", "FinalDisposition", "DispositionText"];
const PRIORITY_MOD_KEYS = ["PriorityModifier", "ResponseModifier", "Modifier", "PriorityName"];
const CALLER_ADDRESS_KEYS = ["CallerAddress", "AliAddress", "ALIAddress", "E911Address", "AniAliAddress", "RPAddress"];
const RELATED_KEYS = [
  "RelatedIncidents",
  "RelatedCalls",
  "RelatedCFS",
  "LinkedEvents",
  "RelatedEventIds",
  "ParentEventId",
  "MasterIncident",
  "MasterCallNumber",
];
const DUPLICATE_KEYS = ["DuplicateOf", "DuplicateOfEvent", "OriginalIncidentNumber", "MasterIncidentNumber"];
const ALERT_KEYS = ["Alerts", "Hazards", "PremiseHazards", "WarningFlags", "SafetyAlerts"];
const UNIT_DETAIL_KEYS = ["Units", "UnitList", "AssignedUnits", "DispatchedUnits", "Apparatus", "Unit"];

function parseCadIdList(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string" && v.trim()) {
    return v.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
  }
  if (Array.isArray(v)) {
    return v
      .flatMap((item) => {
        if (typeof item === "string") return [item.trim()];
        const rec = asRecord(item);
        if (!rec) return [];
        const id = pickFirstString(rec, [
          "IncidentNumber",
          "EventId",
          "EventID",
          "CallNumber",
          "cadNumber",
          "id",
        ]);
        return id ? [id] : [];
      })
      .filter(Boolean)
      .slice(0, 20);
  }
  const rec = asRecord(v);
  if (!rec) return [];
  return parseCadIdList(rec.Items ?? rec.items ?? rec.value);
}

export function parseCadEtaSeconds(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v < 0) return undefined;
    if (v <= 180) return Math.round(v * 60);
    if (v <= 86_400) return Math.round(v);
    return undefined;
  }
  const s = String(v).trim();
  if (!s) return undefined;
  const iso = Date.parse(s);
  if (Number.isFinite(iso) && /t/i.test(s)) {
    const remaining = Math.round((iso - Date.now()) / 1000);
    return remaining > 0 && remaining <= 86_400 ? remaining : undefined;
  }
  const hm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    const sec = Number(hm[3] ?? "0");
    const total = h * 3600 + m * 60 + sec;
    if (total <= 86_400) return total;
  }
  const mins = /^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes)?$/i.exec(s);
  if (mins) {
    const n = Number(mins[1]);
    if (Number.isFinite(n) && n >= 0 && n <= 1440) return Math.round(n * 60);
  }
  return undefined;
}

export function parseCadUnitDetails(v: unknown): CadUnitAssignment[] {
  if (v == null) return [];
  if (typeof v === "string") {
    return parseCadUnits(v).map((unitId) => ({ unitId }));
  }
  const items: unknown[] = Array.isArray(v)
    ? v
    : (() => {
        const rec = asRecord(v);
        if (!rec) return [];
        const nested = rec.Unit ?? rec.Units ?? rec.unit ?? rec.units ?? rec.UnitList;
        if (nested !== undefined) return Array.isArray(nested) ? nested : [nested];
        return [rec];
      })();
  const out: CadUnitAssignment[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const unitId = item.trim();
      if (unitId) out.push({ unitId });
      continue;
    }
    const rec = asRecord(item);
    if (!rec) continue;
    const unitId = pickFirstString(rec, ["UnitId", "unitId", "unit_id", "Unit", "id", "Code", "UnitCode", "CallSign"]);
    if (!unitId) continue;
    const rawEtaSeconds = pickFirst(rec, ["etaSeconds", "EtaSeconds"]);
    let etaSeconds: number | undefined;
    if (typeof rawEtaSeconds === "number" && Number.isFinite(rawEtaSeconds) && rawEtaSeconds >= 0 && rawEtaSeconds <= 86_400) {
      etaSeconds = Math.round(rawEtaSeconds);
    } else if (typeof rawEtaSeconds === "string" && rawEtaSeconds.trim()) {
      const n = Number.parseFloat(rawEtaSeconds);
      if (Number.isFinite(n) && n >= 0 && n <= 86_400) etaSeconds = Math.round(n);
    }
    if (etaSeconds === undefined) {
      const mins = pickFirst(rec, ["etaMinutes", "EtaMinutes", "ETAMinutes"]);
      if (mins == null) {
        etaSeconds = parseCadEtaSeconds(pickFirst(rec, ["ETA", "Eta", "eta"]));
      } else {
        const n = typeof mins === "number" ? mins : Number.parseFloat(String(mins));
        etaSeconds = Number.isFinite(n) && n >= 0 && n <= 1440 ? Math.round(n * 60) : undefined;
      }
    }
    const detail: CadUnitAssignment = { unitId };
    const unitType = pickFirstString(rec, ["UnitType", "unitType", "Type", "ApparatusType"]);
    const status = pickFirstString(rec, ["Status", "status", "UnitStatus"]);
    const beat = pickFirstString(rec, BEAT_KEYS);
    const callSign = pickFirstString(rec, ["CallSign", "callSign", "RadioId", "RadioName"]);
    if (unitType) detail.unitType = unitType;
    if (status) detail.status = status;
    if (etaSeconds !== undefined) detail.etaSeconds = etaSeconds;
    if (beat) detail.beat = beat;
    if (callSign) detail.callSign = callSign;
    out.push(detail);
  }
  return out.slice(0, 200);
}

function parseLocationSource(raw: string | undefined): CadLocationSource | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "cad") return "cad";
  if (s === "e911" || s === "e9-1-1" || s === "911") return "e911";
  if (s === "ali" || s === "ani/ali" || s === "aniali") return "ali";
  if (s === "manual" || s === "dispatcher") return "manual";
  return undefined;
}

function parseAniAliSource(record: Record<string, unknown>, callerAddress?: string): CadAniAliSource | undefined {
  if (pickFirst(record, ["ALI", "Ali", "E911", "E911Data", "AniAli"])) return "e911";
  if (callerAddress) return "e911";
  if (pickFirst(record, ["ANI", "Ani"])) return "cad";
  return undefined;
}

function parseCadAlerts(v: unknown): CadAlert[] {
  if (v == null) return [];
  if (typeof v === "string" && v.trim()) return [{ type: "hazard", text: v.trim().slice(0, 500) }];
  if (!Array.isArray(v)) {
    const rec = asRecord(v);
    if (!rec) return [];
    return parseCadAlerts(rec.Alert ?? rec.Hazard ?? rec.items ?? rec.value);
  }
  const out: CadAlert[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim()) {
      out.push({ type: "hazard", text: item.trim().slice(0, 500) });
      continue;
    }
    const rec = asRecord(item);
    if (!rec) continue;
    const text = pickFirstString(rec, ["text", "Text", "Message", "Description", "Hazard", "Flag"]);
    if (!text) continue;
    out.push({
      type: (pickFirstString(rec, ["type", "Type", "Code"]) ?? "hazard").slice(0, 80),
      text: text.slice(0, 500),
    });
  }
  return out.slice(0, 20);
}

function parseIntersection(record: Record<string, unknown>): string | undefined {
  const direct = pickFirstString(record, INTERSECTION_KEYS);
  if (direct) return direct;
  const a = pickFirstString(record, ["CrossStreet1", "crossStreet1"]);
  const b = pickFirstString(record, ["CrossStreet2", "crossStreet2"]);
  if (a && b) return `${a} / ${b}`;
  return a ?? b;
}

/**
 * Overlay GIS / ANI-ALI / related-CFS extras onto a vendor-normalized incident.
 * Existing string fields on `base` win when already populated.
 */
export function enrichNormalizedCadIncident(
  base: NormalizedCadIncident,
  record: Record<string, unknown>,
): NormalizedCadIncident {
  const loc =
    asRecord(record.Location) ??
    asRecord(record.location) ??
    asRecord(record.Address) ??
    asRecord(record.address);
  const sources = loc ? [record, loc] : [record];
  const pickAcross = (keys: string[]): string | undefined => {
    for (const src of sources) {
      const v = pickFirstString(src, keys);
      if (v) return v;
    }
    return undefined;
  };

  const callerAddress = pickFirstString(record, CALLER_ADDRESS_KEYS);
  const relatedFromKeys = RELATED_KEYS.flatMap((k) => parseCadIdList(record[k] ?? pickFirst(record, [k])));
  const relatedCadNumbers = [...new Set(relatedFromKeys.filter((n) => n && n !== base.cadNumber))].slice(0, 20);
  const unitsSource = pickFirst(record, UNIT_DETAIL_KEYS);
  const unitDetails = parseCadUnitDetails(unitsSource);
  const units = base.units.length ? base.units : unitDetails.map((u) => u.unitId);
  const alerts = parseCadAlerts(pickFirst(record, ALERT_KEYS));
  const duplicateOfCadNumber = pickFirstString(record, DUPLICATE_KEYS);
  const locationSource =
    parseLocationSource(pickAcross(LOCATION_SOURCE_KEYS)) ??
    (callerAddress && callerAddress !== base.location ? "ali" : "cad");

  return {
    ...base,
    units,
    priorityModifier: base.priorityModifier ?? pickAcross(PRIORITY_MOD_KEYS),
    disposition: base.disposition ?? pickAcross(DISPOSITION_KEYS),
    intersection: base.intersection ?? parseIntersection(record) ?? (loc ? parseIntersection(loc) : undefined),
    beat: base.beat ?? pickAcross(BEAT_KEYS),
    zone: base.zone ?? pickAcross(ZONE_KEYS),
    jurisdiction: base.jurisdiction ?? pickAcross(JURISDICTION_KEYS),
    locationConfidence: base.locationConfidence ?? pickAcross(LOCATION_CONFIDENCE_KEYS),
    locationSource: base.locationSource ?? locationSource,
    callerAddress: base.callerAddress ?? (callerAddress && callerAddress !== base.location ? callerAddress : undefined),
    aniAliSource: base.aniAliSource ?? parseAniAliSource(record, callerAddress),
    relatedCadNumbers: base.relatedCadNumbers ?? (relatedCadNumbers.length ? relatedCadNumbers : undefined),
    duplicateOfCadNumber: base.duplicateOfCadNumber ?? duplicateOfCadNumber,
    unitDetails: base.unitDetails ?? (unitDetails.length ? unitDetails : undefined),
    alerts: base.alerts ?? (alerts.length ? alerts : undefined),
  };
}

function flattenXmlLeaves(node: unknown, out: Record<string, unknown>): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const el of node) flattenXmlLeaves(el, out);
    return;
  }
  if (typeof node !== "object") return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k.startsWith("@_")) continue;
    if (v !== null && typeof v === "object") {
      flattenXmlLeaves(v, out);
      continue;
    }
    if (out[k] === undefined && v !== undefined && v !== null && String(v).trim() !== "") {
      out[k] = v;
    }
  }
}

export function flattenCadXml(xml: string): Record<string, unknown> {
  const xp = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });
  const doc = xp.parse(xml) as unknown;
  const out: Record<string, unknown> = {};
  flattenXmlLeaves(doc, out);
  return out;
}

function looksLikeIncidentRecord(o: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(o)) {
    if (k === "fieldMapping" || k === "__cadXmlPayload") continue;
    if (!ID_KEY_LOOKUP.has(k.toLowerCase())) continue;
    if (v !== undefined && v !== null && String(v).trim() !== "") return true;
  }
  return false;
}

function extractFromArray(items: unknown[], depth: number): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const item of items) {
    const nested = extractCadIncidentRecords(item, depth + 1);
    if (nested.length) {
      out.push(...nested);
      continue;
    }
    const rec = asRecord(item);
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * Unwrap vendor envelopes (`incidents`, `events`, `payload`, XML) into incident records.
 * Empty or unrecognized shapes return [].
 */
export function extractCadIncidentRecords(raw: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5 || raw == null) return [];

  if (typeof raw === "string") {
    const t = raw.trim();
    if (t.startsWith("<") || /^<\?xml/i.test(t)) return [flattenCadXml(t)];
    return [];
  }

  if (Array.isArray(raw)) return extractFromArray(raw, depth);

  const o = asRecord(raw);
  if (!o) return [];

  if (typeof o.__cadXmlPayload === "string") {
    return extractCadIncidentRecords(o.__cadXmlPayload, depth + 1);
  }

  for (const k of LIST_KEYS) {
    const v = o[k];
    if (Array.isArray(v)) return extractFromArray(v, depth);
    if (v !== null && typeof v === "object") {
      const nested = extractCadIncidentRecords(v, depth + 1);
      if (nested.length) return nested;
    }
  }

  for (const k of WRAP_KEYS) {
    const v = o[k];
    if (v == null) continue;
    const nested = extractCadIncidentRecords(v, depth + 1);
    if (nested.length) return nested;
  }

  if (looksLikeIncidentRecord(o)) return [o];
  return [];
}

export function cadXmlPayload(raw: unknown): string | null {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t.startsWith("<") || /^<\?xml/i.test(t)) return t;
    return null;
  }
  const o = asRecord(raw);
  if (o && typeof o.__cadXmlPayload === "string") return o.__cadXmlPayload;
  return null;
}

export function resolveIncidentRecord(raw: unknown): Record<string, unknown> {
  const xml = cadXmlPayload(raw);
  if (xml) return flattenCadXml(xml);
  const records = extractCadIncidentRecords(raw);
  if (records.length) return records[0]!;
  return asRecord(raw) ?? {};
}

function xmlLooksLikeCadId(xml: string, keys: string[]): boolean {
  return keys.some((k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(xml));
}

export function anyExtractedRecordHasCadId(raw: unknown, keys: string[]): boolean {
  const xml = cadXmlPayload(raw);
  if (xml) return xmlLooksLikeCadId(xml, keys);
  const records = extractCadIncidentRecords(raw);
  if (records.length) return records.some((r) => pickFirstString(r, keys) !== undefined);
  const o = asRecord(raw);
  return o ? pickFirstString(o, keys) !== undefined : false;
}

import { XMLParser } from "fast-xml-parser";
import type { CadIntegrationSetupContext } from "../types.js";
import type { CadParser } from "../types.js";
import type { NormalizedCadIncident } from "../types.js";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizePriority(v: unknown): NormalizedCadIncident["priority"] {
  const s = String(v ?? "P3").toUpperCase();
  if (s === "P1" || s === "P2" || s === "P3" || s === "P4") return s;
  if (s === "1" || s === "E" || s === "EMERGENCY") return "P1";
  if (s === "2" || s === "HIGH") return "P2";
  if (s === "4" || s === "LOW") return "P4";
  return "P3";
}

function toUnits(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(/[,;\s]+/).filter(Boolean);
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    const u = (v as Record<string, unknown>).Unit;
    if (Array.isArray(u)) return u.map((x) => asRecord(x)?.UnitId ?? x).map(String).filter(Boolean);
    const one = asRecord(u);
    if (one) return [String(one.UnitId ?? one.unitId ?? one.Id ?? "")].filter(Boolean);
  }
  return [];
}

function findFirstDeep(node: unknown, keys: string[]): unknown {
  if (node === null || node === undefined) return undefined;
  if (Array.isArray(node)) {
    for (const el of node) {
      const f = findFirstDeep(el, keys);
      if (f !== undefined) return f;
    }
    return undefined;
  }
  if (typeof node !== "object") return undefined;
  const o = node as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  for (const v of Object.values(o)) {
    const f = findFirstDeep(v, keys);
    if (f !== undefined) return f;
  }
  return undefined;
}

function flattenMotorolaXml(xml: string): Record<string, unknown> {
  const xp = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });
  const doc = xp.parse(xml) as unknown;
  const incidentNumber = findFirstDeep(doc, ["IncidentNumber", "incidentNumber", "IncidentId", "CallNumber"]);
  const nature = findFirstDeep(doc, ["NatureCode", "natureCode", "CallType", "Nature"]);
  const location = findFirstDeep(doc, ["Location", "location", "Address", "FullAddress"]);
  const priority = findFirstDeep(doc, ["Priority", "priority", "CallPriority"]);
  const status = findFirstDeep(doc, ["Status", "IncidentStatus", "Disposition", "EventStatus"]);
  const units = findFirstDeep(doc, ["Units", "AssignedUnits", "Apparatus"]);
  const callerBlock = findFirstDeep(doc, ["CallerInfo", "callerInfo", "Caller", "caller"]);
  const rootPhone = findFirstDeep(doc, ["CallerPhone", "callerPhone", "CallbackNumber", "callbackNumber"]);
  const notes = findFirstDeep(doc, ["Notes", "Narrative", "Remarks"]);
  const eventType = findFirstDeep(doc, ["EventType", "eventType", "Type"]);
  const seq = findFirstDeep(doc, ["Sequence", "sequence", "Revision", "revision", "MsgSeq"]);
  const mergedCaller =
    callerBlock ?? (rootPhone !== undefined && rootPhone !== null && String(rootPhone).trim() !== "" ? { Callback: rootPhone } : undefined);
  return {
    IncidentNumber: incidentNumber,
    NatureCode: nature,
    Location: location,
    Priority: priority,
    Status: status,
    Units: units,
    CallerInfo: mergedCaller,
    Notes: notes,
    EventType: eventType,
    Sequence: typeof seq === "number" ? seq : typeof seq === "string" ? Number.parseInt(seq, 10) : undefined,
  };
}

function parseMotorolaRecord(o: Record<string, unknown>): NormalizedCadIncident {
  const cadNumber = String(o.IncidentNumber ?? o.incidentNumber ?? o.IncidentId ?? o.CallNumber ?? "UNKNOWN");
  const incidentType = String(o.NatureCode ?? o.natureCode ?? o.EventType ?? o.eventType ?? o.CallType ?? "UNKNOWN");
  const location = String(o.Location ?? o.location ?? o.Address ?? o.FullAddress ?? "");
  const caller = asRecord(o.CallerInfo) ?? asRecord(o.callerInfo) ?? asRecord(o.Caller);
  const revRaw = o.Sequence ?? o.sequence ?? o.Revision ?? o.revision ?? o.MsgSeq;
  let revision: number | undefined;
  if (typeof revRaw === "number" && Number.isFinite(revRaw)) revision = revRaw;
  else if (typeof revRaw === "string" && revRaw.trim()) {
    const n = Number.parseInt(revRaw, 10);
    if (Number.isFinite(n)) revision = n;
  }
  const cbFromCaller = caller ? String(caller.Callback ?? caller.callback ?? caller.Phone ?? caller.phone ?? "") : "";
  const cbRoot = typeof o.CallerPhone === "string" ? o.CallerPhone : typeof o.callerPhone === "string" ? o.callerPhone : "";
  return {
    cadNumber,
    incidentType,
    priority: normalizePriority(o.Priority ?? o.priority ?? o.CallPriority),
    location: location || "Unknown",
    callerCallback: cbFromCaller || cbRoot || undefined,
    callerName: caller ? String(caller.Name ?? caller.name ?? caller.CallerName ?? "") : undefined,
    units: toUnits(o.Units ?? o.units ?? o.AssignedUnits ?? o.Apparatus),
    notes: typeof o.Notes === "string" ? o.Notes : typeof o.Narrative === "string" ? o.Narrative : undefined,
    cadStatus: typeof o.Status === "string" ? o.Status : typeof o.IncidentStatus === "string" ? o.IncidentStatus : undefined,
    revision: Number.isFinite(revision as number) ? (revision as number) : undefined,
    rawPayload: o,
  };
}

function tp(i: CadIntegrationSetupContext): string {
  return i.tokenPreview?.trim() || "****";
}

export const motorolaPremierOneCadParser: CadParser = {
  vendor: "motorola_premier_one",
  validate(rawPayload: unknown): boolean {
    if (typeof rawPayload === "string") {
      const s = rawPayload.trim();
      if (/^<\?xml/i.test(s) || s.startsWith("<")) {
        return (
          /IncidentNumber/i.test(s) ||
          /incidentNumber/i.test(s) ||
          /IncidentId/i.test(s) ||
          /CallNumber/i.test(s)
        );
      }
      return false;
    }
    const o = asRecord(rawPayload);
    if (o?.__cadXmlPayload && typeof o.__cadXmlPayload === "string") {
      const x = o.__cadXmlPayload;
      return (
        /IncidentNumber/i.test(x) ||
        /incidentNumber/i.test(x) ||
        /IncidentId/i.test(x) ||
        /CallNumber/i.test(x)
      );
    }
    if (!o) return false;
    return (
      typeof o.IncidentNumber === "string" ||
      typeof o.incidentNumber === "string" ||
      typeof o.IncidentId === "string" ||
      typeof o.CallNumber === "string"
    );
  },
  parse(rawPayload: unknown): NormalizedCadIncident {
    if (typeof rawPayload === "string") {
      return parseMotorolaRecord(flattenMotorolaXml(rawPayload.trim()));
    }
    const o = asRecord(rawPayload) ?? {};
    if (typeof o.__cadXmlPayload === "string") {
      const flat = flattenMotorolaXml(o.__cadXmlPayload);
      return parseMotorolaRecord(flat);
    }
    return parseMotorolaRecord(o);
  },
  generateSetupInstructions(integration: CadIntegrationSetupContext): string {
    const u = integration.webhookUrl;
    return [
      `Motorola PremierOne — setup for “${integration.name}” (${integration.id}):`,
      "",
      "1) Log into PremierOne Admin Console.",
      "2) Navigate to: System → Integrations → External Notifications (or your agency’s equivalent outbound HTTP path).",
      "3) Add notification:",
      `   • URL: ${u}`,
      "   • Method: POST",
      "   • Format: JSON or application/xml (Rapid Cortex parses PremierOne-style IncidentNotification XML).",
      `   • Header: X-RC-Token: <token ending …${tp(integration)}>`,
      "   • Optional integrity: X-RC-Signature: sha256=<hex> (HMAC-SHA256 of raw body, key = plaintext token).",
      "4) Events: enable IncidentCreate, IncidentUpdate, UnitStatusChange (as applicable).",
      "5) Save and send a test notification.",
      "",
      "Field hints: IncidentNumber, NatureCode, Address/Location, Priority, Units/Unit/UnitId, CallerPhone or CallerInfo.",
    ].join("\n");
  },
};

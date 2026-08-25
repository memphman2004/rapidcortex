import { describe, expect, it } from "vitest";
import { centralSquareCadParser } from "./centralSquare.js";
import { motorolaPremierOneCadParser } from "./motorolaPremierOne.js";
import { extractCadIncidentRecords } from "./parse-helpers.js";
import { tylerNewWorldCadParser } from "./tylerNewWorld.js";

describe("extractCadIncidentRecords", () => {
  it("unwraps incidents / events / Incidents envelopes", () => {
    expect(extractCadIncidentRecords({ incidents: [{ EventId: "A" }] })).toHaveLength(1);
    expect(extractCadIncidentRecords({ events: [{ eventNumber: "B" }] })).toHaveLength(1);
    expect(extractCadIncidentRecords({ Incidents: [{ IncidentId: "C" }] })).toHaveLength(1);
  });

  it("unwraps nested data.incidents", () => {
    const rows = extractCadIncidentRecords({ data: { incidents: [{ EventId: "N1" }, { EventId: "N2" }] } });
    expect(rows.map((r) => r.EventId)).toEqual(["N1", "N2"]);
  });

  it("returns empty for unrecognized objects", () => {
    expect(extractCadIncidentRecords({ status: "ok" })).toEqual([]);
  });
});

describe("motorolaPremierOneCadParser", () => {
  it("parses PremierOne poll JSON (EventId / CallNumber / NatureCode)", () => {
    const payload = {
      EventId: "EVT-001",
      CallNumber: "24-001",
      NatureCode: "SHOTS",
      Priority: "1",
      Location: "123 Main St",
      Latitude: "33.749",
      Longitude: "-84.388",
      CallerName: "Jane Doe",
      CallerPhone: "+14045551234",
      Narrative: "Caller heard shots",
      Units: "P1,M2",
      Status: "ACTIVE",
    };
    expect(motorolaPremierOneCadParser.validate(payload)).toBe(true);
    const n = motorolaPremierOneCadParser.parse(payload);
    expect(n.cadNumber).toBe("EVT-001");
    expect(n.incidentType).toBe("SHOTS");
    expect(n.priority).toBe("P1");
    expect(n.location).toBe("123 Main St");
    expect(n.coordinates).toEqual({ lat: 33.749, lng: -84.388 });
    expect(n.callerName).toBe("Jane Doe");
    expect(n.callerCallback).toBe("+14045551234");
    expect(n.notes).toBe("Caller heard shots");
    expect(n.units).toEqual(["P1", "M2"]);
    expect(n.cadStatus).toBe("ACTIVE");
  });

  it("parses IncidentNotification XML", () => {
    const xml = `<?xml version="1.0"?>
      <IncidentNotification>
        <IncidentNumber>24-0099</IncidentNumber>
        <NatureCode>MVC</NatureCode>
        <Location>9 Oak Rd</Location>
        <Priority>2</Priority>
        <Units><Unit><UnitId>E1</UnitId></Unit></Units>
        <CallerInfo><Name>RP</Name><Callback>5551212</Callback></CallerInfo>
      </IncidentNotification>`;
    expect(motorolaPremierOneCadParser.validate(xml)).toBe(true);
    const n = motorolaPremierOneCadParser.parse(xml);
    expect(n.cadNumber).toBe("24-0099");
    expect(n.incidentType).toBe("MVC");
    expect(n.priority).toBe("P2");
    expect(n.units).toContain("E1");
    expect(n.callerCallback).toBe("5551212");
  });

  it("parses wrapped { incidents: [...] } batches (first record via parse)", () => {
    const wrapped = { incidents: [{ EventId: "E-1", NatureCode: "FIRE", Location: "1 St" }, { EventId: "E-2" }] };
    expect(motorolaPremierOneCadParser.validate(wrapped)).toBe(true);
    expect(motorolaPremierOneCadParser.parse(wrapped).cadNumber).toBe("E-1");
    expect(extractCadIncidentRecords(wrapped)).toHaveLength(2);
  });

  it("rejects empty payloads", () => {
    expect(motorolaPremierOneCadParser.validate({})).toBe(false);
    expect(motorolaPremierOneCadParser.validate({ foo: 1 })).toBe(false);
  });

  it("parses beat, intersection, related CFS, ANI/ALI, and unit ETA", () => {
    const payload = {
      EventId: "EVT-GIS",
      NatureCode: "DV-IP",
      Location: "Main St / 5th Ave",
      Beat: "4A",
      Zone: "North",
      Intersection: "Main / 5th",
      Jurisdiction: "Example PD",
      DispositionCode: "RPT",
      PriorityModifier: "Echo",
      CallerAddress: "12 Caller Ln",
      RelatedCalls: "24-100,24-101",
      DuplicateOf: "24-099",
      Units: [
        { UnitId: "P12", Status: "enroute", ETA: 4, Beat: "4A", CallSign: "Adam-12" },
        { UnitId: "M1", etaSeconds: 90 },
      ],
      Alerts: [{ Type: "hazard", Text: "Dogs on premise" }],
    };
    const n = motorolaPremierOneCadParser.parse(payload);
    expect(n.beat).toBe("4A");
    expect(n.zone).toBe("North");
    expect(n.intersection).toBe("Main / 5th");
    expect(n.jurisdiction).toBe("Example PD");
    expect(n.disposition).toBe("RPT");
    expect(n.priorityModifier).toBe("Echo");
    expect(n.callerAddress).toBe("12 Caller Ln");
    expect(n.relatedCadNumbers).toEqual(["24-100", "24-101"]);
    expect(n.duplicateOfCadNumber).toBe("24-099");
    expect(n.unitDetails?.[0]?.unitId).toBe("P12");
    expect(n.unitDetails?.[0]?.etaSeconds).toBe(240);
    expect(n.unitDetails?.[1]?.etaSeconds).toBe(90);
    expect(n.alerts?.[0]?.text).toMatch(/Dogs/);
  });
});

describe("centralSquareCadParser", () => {
  it("parses PascalCase Integration Engine payloads", () => {
    const payload = {
      IncidentId: "CS-2024-000456",
      IncidentNumber: "24-456",
      NatureOfCall: "FIRE",
      Priority: "1",
      Address: "789 Elm St",
      Lat: "33.755",
      Lon: "-84.395",
      CallerName: "Alice Johnson",
      CallerPhone: "4045559876",
      Comments: "Large structure fire",
      UnitList: "E5,L2,BC1",
      Status: "DISPATCHED",
    };
    expect(centralSquareCadParser.validate(payload)).toBe(true);
    const n = centralSquareCadParser.parse(payload);
    expect(n.cadNumber).toBe("CS-2024-000456");
    expect(n.incidentType).toBe("FIRE");
    expect(n.priority).toBe("P1");
    expect(n.location).toBe("789 Elm St");
    expect(n.units).toEqual(["E5", "L2", "BC1"]);
    expect(n.callerName).toBe("Alice Johnson");
    expect(n.notes).toBe("Large structure fire");
    expect(n.coordinates?.lat).toBeCloseTo(33.755);
  });

  it("parses snake_case incident_id payloads", () => {
    const payload = {
      incident_id: "cs-99",
      nature: "MED",
      address: "2 Pine",
      priority: "P3",
      assigned_units: [{ unit_id: "M1" }],
      callback: "5550000",
      caller_name: "RP",
    };
    expect(centralSquareCadParser.validate(payload)).toBe(true);
    const n = centralSquareCadParser.parse(payload);
    expect(n.cadNumber).toBe("cs-99");
    expect(n.units).toEqual(["M1"]);
    expect(n.callerCallback).toBe("5550000");
  });

  it("parses { Incidents: [...] } envelopes", () => {
    const wrapped = { Incidents: [{ IncidentId: "A" }, { IncidentId: "B" }] };
    expect(centralSquareCadParser.validate(wrapped)).toBe(true);
    expect(extractCadIncidentRecords(wrapped)).toHaveLength(2);
  });
});

describe("tylerNewWorldCadParser", () => {
  it("parses New World camelCase poll events", () => {
    const payload = {
      eventNumber: "2024-1234",
      callNumber: "E24001234",
      callType: "ASSAULT",
      priority: "2",
      locationAddress: "456 Oak Ave",
      gpsLat: "33.752",
      gpsLon: "-84.391",
      callerName: "Bob Smith",
      callerPhone: "4045550000",
      remarks: "Physical fight in progress",
      assignedUnits: "P12,F4",
      eventStatus: "ACTIVE",
    };
    expect(tylerNewWorldCadParser.validate(payload)).toBe(true);
    const n = tylerNewWorldCadParser.parse(payload);
    expect(n.cadNumber).toBe("2024-1234");
    expect(n.incidentType).toBe("ASSAULT");
    expect(n.priority).toBe("P2");
    expect(n.location).toBe("456 Oak Ave");
    expect(n.units).toEqual(["P12", "F4"]);
    expect(n.notes).toBe("Physical fight in progress");
    expect(n.coordinates?.lat).toBeCloseTo(33.752);
  });

  it("parses snake_case call_number payloads", () => {
    const payload = {
      call_number: "NW-1",
      call_type: "MVC",
      location_text: "Hwy 1",
      priority_code: 1,
      apparatus: [{ unitId: "E9" }],
    };
    expect(tylerNewWorldCadParser.validate(payload)).toBe(true);
    const n = tylerNewWorldCadParser.parse(payload);
    expect(n.cadNumber).toBe("NW-1");
    expect(n.priority).toBe("P1");
    expect(n.units).toEqual(["E9"]);
  });

  it("parses { events: [...] } envelopes", () => {
    const wrapped = { events: [{ eventNumber: "1" }, { eventNumber: "2" }] };
    expect(tylerNewWorldCadParser.validate(wrapped)).toBe(true);
    expect(extractCadIncidentRecords(wrapped)).toHaveLength(2);
  });
});

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MotorolaPremierOneBridgeAdapter } from "./motorola.js";
import { TylerNewWorldBridgeAdapter } from "./tyler.js";
import { RestVendorBridgeAdapter } from "./rest-vendors.js";

describe("Motorola PremierOne bridge adapter", () => {
  const adapter = new MotorolaPremierOneBridgeAdapter();

  it("rejects a bad HMAC and accepts a matching sha256 hex signature", () => {
    const body = JSON.stringify({ eventType: "INCIDENT_CREATED", incidentData: { incidentId: "P1-1" } });
    const secret = "whsec";
    expect(adapter.validateSignature(body, "sha256=deadbeef", secret)).toBe(false);
    const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(adapter.validateSignature(body, `sha256=${sig}`, secret)).toBe(true);
  });

  it("parses PremierOne sample fields into canonical", async () => {
    const event = await adapter.parseInbound(
      JSON.stringify({
        eventType: "INCIDENT_CREATED",
        EventNumber: "P1-1001",
        CallType: "ARMED ROBBERY",
        Priority: 1,
        IncidentStatus: "ONSCENE",
        Location: { FullAddress: "123 Main St", Latitude: 33.749, Longitude: -84.388 },
      }),
      {},
      "kcpd",
    );
    expect(event.sourceIncidentId).toBe("P1-1001");
    const canonical = adapter.toCanonical(event);
    expect(canonical.type).toBe("ARMED ROBBERY");
    expect(canonical.priority).toBe(1);
    expect(canonical.status).toBe("ONSCENE");
    expect(canonical.location?.address).toBe("123 Main St");
  });
});

describe("Tyler New World bridge adapter", () => {
  const adapter = new TylerNewWorldBridgeAdapter();

  it("maps inc_nbr / call_type_cd / priority_nbr from the existing Tyler sample shape", async () => {
    const event = await adapter.parseInbound(
      JSON.stringify({
        event: { type: "incident.created", data: { inc_nbr: "NW-7734", call_type_cd: "STRUCTURE FIRE", priority_nbr: 2, inc_status_cd: "ENRT" } },
      }),
      {},
      "kcpd",
    );
    expect(event.eventType).toBe("INCIDENT_CREATED");
    expect(event.sourceIncidentId).toBe("NW-7734");
    const canonical = adapter.toCanonical(event);
    expect(canonical.type).toBe("STRUCTURE FIRE");
    expect(canonical.priority).toBe(2);
    expect(canonical.status).toBe("DISPATCHED");
  });
});

describe("CentralSquare / Hexagon / Spillman adapters", () => {
  it("parses each vendor sample incident id", async () => {
    const cs = new RestVendorBridgeAdapter("CENTRALSQUARE");
    const hx = new RestVendorBridgeAdapter("HEXAGON");
    const sp = new RestVendorBridgeAdapter("SPILLMAN");
    expect((await cs.parseInbound(JSON.stringify({ call_number: "CS-4410", call_type: "TRAFFIC STOP" }), {}, "a")).sourceIncidentId).toBe("CS-4410");
    expect((await hx.parseInbound(JSON.stringify({ CallId: "HX-2201", CallCode: "MEDICAL EMERGENCY" }), {}, "a")).sourceIncidentId).toBe("HX-2201");
    expect((await sp.parseInbound(JSON.stringify({ callId: "SP-9001", callType: "WELFARE CHECK" }), {}, "a")).sourceIncidentId).toBe("SP-9001");
  });
});

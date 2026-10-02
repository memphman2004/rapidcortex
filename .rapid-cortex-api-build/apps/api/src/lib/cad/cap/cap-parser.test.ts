import { describe, expect, it } from "vitest";
import { capToPriority } from "./cap-types.js";
import { extractFipsCodes, parseCapXml, shouldProcessAlert } from "./cap-parser.js";
import type { CapInfo } from "./cap-types.js";

describe("capToPriority", () => {
  it("maps Immediate + Extreme/Severe to P1", () => {
    expect(capToPriority("Immediate", "Extreme")).toBe("P1");
    expect(capToPriority("Immediate", "Severe")).toBe("P1");
  });

  it("never downgrades Immediate below P2", () => {
    expect(capToPriority("Immediate", "Moderate")).toBe("P2");
    expect(capToPriority("Immediate", "Minor")).toBe("P2");
    expect(capToPriority("Immediate", "Unknown")).toBe("P2");
  });
});

describe("parseCapXml", () => {
  const sample = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>test-123</identifier>
  <sender>test@example.com</sender>
  <sent>2026-06-01T12:00:00-00:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>en-US</language>
    <category>Met</category>
    <event>Tornado Warning</event>
    <urgency>Immediate</urgency>
    <severity>Extreme</severity>
    <certainty>Observed</certainty>
    <headline>Tornado Warning</headline>
    <area>
      <areaDesc>Test County</areaDesc>
      <geocode><valueName>FIPS6</valueName><value>013089</value></geocode>
    </area>
  </info>
</alert>`;

  it("parses minimal CAP alert", () => {
    const result = parseCapXml(sample);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alert.identifier).toBe("test-123");
    expect(result.alert.infos[0]?.event).toBe("Tornado Warning");
  });

  it("extracts FIPS codes", () => {
    const result = parseCapXml(sample);
    if (!result.ok) throw new Error("parse failed");
    const fips = extractFipsCodes(result.alert.infos);
    expect(fips).toContain("013089");
  });

  it("skips Test alerts by default", () => {
    const testXml = sample.replace("<status>Actual</status>", "<status>Test</status>");
    const result = parseCapXml(testXml);
    if (!result.ok) throw new Error("parse failed");
    const v = shouldProcessAlert(result.alert, { acceptTest: false });
    expect(v.shouldProcess).toBe(false);
  });
});

describe("shouldProcessAlert", () => {
  it("requires info blocks", () => {
    const v = shouldProcessAlert(
      {
        identifier: "x",
        sender: "y",
        sent: "z",
        status: "Actual",
        msgType: "Alert",
        scope: "Public",
        codes: [],
        infos: [] as CapInfo[],
        rawXml: "",
      },
      {},
    );
    expect(v.shouldProcess).toBe(false);
  });
});

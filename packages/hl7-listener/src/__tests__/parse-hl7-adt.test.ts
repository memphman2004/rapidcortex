import { describe, expect, it } from "vitest";
import { parseHl7AdtMessage } from "../parse-hl7-adt.js";
import { extractMllpMessages, wrapMllp } from "../mllp.js";

const SAMPLE = [
  "MSH|^~\\&|HOSPITAL_SYSTEM|SARASOTA_MEM|RAPID_CORTEX|DISPATCH|20260515143022||ADT^A01|MSG00001|P|2.5",
  "EVN|A01|20260515143022",
  "PV1|1|E|ER^B^01^HOSP^^^^|U",
].join("\r");

describe("parseHl7AdtMessage", () => {
  it("parses ADT^A01 admit to ER", () => {
    const parsed = parseHl7AdtMessage(SAMPLE);
    expect(parsed).not.toBeNull();
    expect(parsed?.sendingFacility).toBe("SARASOTA_MEM");
    expect(parsed?.messageType).toBe("ADT^A01");
    expect(parsed?.event).toBe("admit");
    expect(parsed?.department).toBe("er");
    expect(parsed?.bedId).toBe("01");
  });

  it("maps A03 to discharge", () => {
    const msg = SAMPLE.replace("EVN|A01", "EVN|A03");
    const parsed = parseHl7AdtMessage(msg);
    expect(parsed?.event).toBe("discharge");
  });
});

describe("mllp framing", () => {
  it("extracts one message from buffer", () => {
    const framed = wrapMllp(SAMPLE);
    const { messages, remainder } = extractMllpMessages(framed);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("MSH|");
    expect(remainder).toBe("");
  });
});

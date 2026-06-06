import { Hl7Listener } from "./hl7-listener.js";
import { loadFacilityMap } from "./facility-map.js";

const SAMPLE_ADT = [
  "MSH|^~\\&|HOSPITAL_SYSTEM|SARASOTA_MEM|RAPID_CORTEX|DISPATCH|20260515143022||ADT^A01|MSG00001|P|2.5",
  "EVN|A01|20260515143022",
  "PID|1||12345^^^HOSP^MR||DOE^JOHN^||19800101|M",
  "PV1|1|E|ER^B^01^HOSP^^^^|U|||ER001^SMITH^JANE|||||||||||V|||||||||||||||||||||||||20260515142800",
].join("\r");

async function main(): Promise<void> {
  const tableName = process.env.HOSPITAL_CAPACITY_TABLE?.trim() ?? "";
  const port = Number.parseInt(process.env.HL7_PORT ?? "2575", 10);
  const mock = process.env.HL7_MOCK === "true";
  const debounceMs = mock
    ? 0
    : Number.parseInt(process.env.HL7_PUSH_DEBOUNCE_MS ?? "5000", 10);

  if (!tableName && !mock) {
    console.error("HOSPITAL_CAPACITY_TABLE is required (or set HL7_MOCK=true for dry-run)");
    process.exit(1);
  }

  const facilityMap = loadFacilityMap();
  const listener = new Hl7Listener(facilityMap, tableName || "dry-run", port, debounceMs);

  if (mock) {
    console.log("[hl7] mock mode — processing sample ADT^A01");
    const ack = await listener.processRawMessage(SAMPLE_ADT);
    await listener.flushPendingWrites();
    console.log(`[hl7] mock complete, ack=${ack}`);
    return;
  }

  await listener.start();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

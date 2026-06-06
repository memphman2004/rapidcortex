import {
  hl7ParsedAdtMessageSchema,
  type Hl7Department,
  type Hl7ParsedAdtMessage,
  type Hl7PatientEvent,
} from "rapid-cortex-shared";

function mapEventCode(code: string): Hl7PatientEvent {
  if (code.startsWith("A03")) return "discharge";
  if (code.startsWith("A02")) return "transfer";
  return "admit";
}

export function mapDepartmentCode(locationCode: string): Hl7Department {
  const code = locationCode.toUpperCase();
  if (code.includes("ER") || code.includes("ED")) return "er";
  if (code.includes("ICU") || code.includes("CCU")) return "icu";
  if (code.includes("TRAUMA")) return "trauma";
  if (code.includes("OB") || code.includes("L&D")) return "ob";
  if (code.includes("PSYCH")) return "psychiatric";
  return "general";
}

/**
 * Parse HL7 v2.x ADT payload (segments separated by CR).
 * Returns null when required MSH fields are missing.
 */
export function parseHl7AdtMessage(raw: string): Hl7ParsedAdtMessage | null {
  const segments = raw.split(/\r|\n/).filter((s) => s.length > 0);

  let messageType = "";
  let messageControlId: string | undefined;
  let timestamp = "";
  let sendingFacility = "";
  let eventCode = "A01";
  let department: Hl7Department = "er";
  let bedId: string | undefined;

  for (const segment of segments) {
    const fields = segment.split("|");
    const kind = fields[0];

    if (kind === "MSH") {
      sendingFacility = fields[3]?.trim() ?? "";
      timestamp = fields[6]?.trim() ?? "";
      messageType = fields[8]?.trim() ?? "";
      messageControlId = fields[9]?.trim();
    } else if (kind === "EVN") {
      eventCode = fields[1]?.trim() ?? "A01";
    } else if (kind === "PV1") {
      const location = fields[3]?.trim() ?? "";
      const parts = location.split("^");
      if (parts[0]) department = mapDepartmentCode(parts[0]);
      if (parts[2]) bedId = parts[2];
    }
  }

  if (!messageType || !timestamp || !sendingFacility) return null;

  const parsed = hl7ParsedAdtMessageSchema.safeParse({
    messageType,
    messageControlId,
    timestamp,
    sendingFacility,
    eventCode,
    event: mapEventCode(eventCode),
    department,
    bedId,
    rawSegmentCount: segments.length,
  });

  return parsed.success ? parsed.data : null;
}

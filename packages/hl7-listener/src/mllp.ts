/** MLLP framing bytes for HL7 over TCP. */
export const MLLP_START = "\x0b";
export const MLLP_END = "\x1c";
export const MLLP_CR = "\x0d";

export type MllpAckCode = "AA" | "AE" | "AR";

export function wrapMllp(payload: string): string {
  return `${MLLP_START}${payload}${MLLP_END}${MLLP_CR}`;
}

export function extractMllpMessages(buffer: string): { messages: string[]; remainder: string } {
  const messages: string[] = [];
  let rest = buffer;

  while (rest.includes(MLLP_START) && rest.includes(MLLP_END)) {
    const startIndex = rest.indexOf(MLLP_START);
    const endIndex = rest.indexOf(MLLP_END);
    if (startIndex > endIndex) break;
    const body = rest.slice(startIndex + 1, endIndex);
    rest = rest.slice(endIndex + 2);
    if (body.length > 0) messages.push(body);
  }

  return { messages, remainder: rest };
}

export function buildAckMessage(ackCode: MllpAckCode, messageControlId: string): string {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const lines = [
    `MSH|^~\\&|RAPID_CORTEX|DISPATCH|HOSPITAL|FACILITY|${ts}||ACK|ACK-${Date.now()}|P|2.5`,
    `MSA|${ackCode}|${messageControlId || "UNKNOWN"}`,
  ];
  return wrapMllp(lines.join("\r"));
}

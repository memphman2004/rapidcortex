import type { DeceptionEvent } from "./deceptionEvent.js";

/** Structured log line only — never pass raw Authorization or bodies. */
export function logDeceptionStructured(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console -- deception module must not depend on prod logging libs
  console.log(
    JSON.stringify({
      type: "deception.shield",
      event,
      ...fields,
      at: new Date().toISOString(),
    }),
  );
}

export function logDeceptionEventSaved(row: DeceptionEvent): void {
  logDeceptionStructured("deception.event_saved", {
    id: row.id,
    eventType: row.eventType,
    riskLevel: row.riskLevel,
    route: row.route,
    method: row.method,
    correlationId: row.correlationId,
    sourceIpMasked: maskIp(row.sourceIp),
  });
}

function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return ip;
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  if (ip.includes(":")) return ip.slice(0, 8) + "…";
  return "masked";
}

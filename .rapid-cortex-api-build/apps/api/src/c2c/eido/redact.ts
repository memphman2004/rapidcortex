import type { EidoEnvelope } from "./types.js";

export interface RedactionPolicy {
  redactedFields: string[];
  allowCJI: boolean;
  hipaaDataAllowed?: boolean;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = cursor[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) return;
    cursor = next as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1]!;
  if (leaf in cursor) cursor[leaf] = value;
}

/** Field-level redaction for a receiving agency. Never mutates the original envelope. */
export function redactForAgency(eido: EidoEnvelope, policy: RedactionPolicy): EidoEnvelope {
  const clone = structuredClone(eido);
  const removed: string[] = [];
  for (const path of policy.redactedFields) {
    const envelopePath = path.startsWith("eido.") ? path.slice("eido.".length) : path;
    setPath(clone as unknown as Record<string, unknown>, envelopePath, null);
    removed.push(path);
  }
  if (!policy.allowCJI) {
    for (const subject of clone.incident.Subjects ?? []) {
      subject.CriminalHistory = undefined;
      subject.WarrantsIndicator = undefined;
      subject.Weapons = undefined;
    }
    clone.incident.LESpecificNotes = undefined;
    for (const entry of clone.incident.Narrative ?? []) {
      if (entry.LESSensitive) entry.Text = "[REDACTED]";
    }
  }
  clone.header.RedactionManifest = [...(clone.header.RedactionManifest ?? []), ...removed];
  return clone;
}

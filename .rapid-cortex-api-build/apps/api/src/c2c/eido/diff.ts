import type { EidoDiff, EidoEnvelope, EidoFieldChange, EidoIncident } from "./types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function walk(prefix: string, prev: unknown, next: unknown, changes: EidoFieldChange[]): void {
  if (Object.is(prev, next)) return;
  if (isPlainObject(prev) && isPlainObject(next)) {
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const key of keys) {
      walk(prefix ? `${prefix}.${key}` : key, prev[key], next[key], changes);
    }
    return;
  }
  if (JSON.stringify(prev) === JSON.stringify(next)) return;
  changes.push({ field: prefix, oldValue: prev, newValue: next });
}

function patchFromChanges(changes: EidoFieldChange[]): Partial<EidoIncident> {
  const patch: Record<string, unknown> = {};
  for (const change of changes) {
    if (!change.field.startsWith("incident.")) continue;
    const path = change.field.slice("incident.".length).split(".");
    let cursor: Record<string, unknown> = patch;
    for (let i = 0; i < path.length - 1; i++) {
      const part = path[i]!;
      if (!isPlainObject(cursor[part])) cursor[part] = {};
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[path[path.length - 1]!] = change.newValue;
  }
  return patch as Partial<EidoIncident>;
}

export function diffEido(prev: EidoEnvelope, next: EidoEnvelope): EidoDiff {
  const changes: EidoFieldChange[] = [];
  walk("header", prev.header, next.header, changes);
  walk("incident", prev.incident, next.incident, changes);
  return {
    previousMessageId: prev.header.MessageId,
    changes,
    patch: patchFromChanges(changes),
  };
}

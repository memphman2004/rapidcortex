export type IdempotentEntry = {
  fingerprint: string;
  statusCode: number;
  payload: Record<string, unknown>;
};

const STORE = new Map<string, IdempotentEntry>();

/** Composite tenant + REST tuple + idempotency token. */

export function buildIdempotentCompositeKey(tenantId: string, method: string, endpoint: string, idempotencyKey: string): string {
  return `${tenantId}:${method}:${endpoint}:${idempotencyKey}`;
}

export function resolveIdempotentEntry(
  compositeKey: string,
  fingerprintHex: string,
): { kind: "first" } | { kind: "replay"; entry: IdempotentEntry } | { kind: "conflict" } {
  const existing = STORE.get(compositeKey);
  if (!existing) return { kind: "first" };
  if (existing.fingerprint !== fingerprintHex) return { kind: "conflict" };
  return { kind: "replay", entry: existing };
}

export function persistIdempotentEntry(compositeKey: string, entry: IdempotentEntry): void {
  STORE.set(compositeKey, entry);
}

/** @internal Testing hook only. */

export function resetIdempotentEntriesForTests(): void {
  STORE.clear();
}

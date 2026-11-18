import type { DemoTokenClaims } from "../types";

export interface DemoTokenRecord {
  jti: string;
  iss: string;
  scenarioId: string;
  exp: number;
  createdAt: number;
}

export interface DemoTokenUse {
  jti: string;
  scenarioId: string;
  at: number;
}

export class MemoryDemoTokenStore {
  private revoked = new Set<string>();
  private revokedIssuers = new Set<string>();
  private issued: DemoTokenRecord[] = [];
  private uses: DemoTokenUse[] = [];

  remember(record: DemoTokenRecord): void {
    this.issued.push(record);
  }

  revoke(jti: string): void {
    this.revoked.add(jti);
  }

  revokeIssuer(issuer: string): void {
    this.revokedIssuers.add(issuer);
    this.issued.filter((record) => record.iss === issuer).forEach((record) => this.revoked.add(record.jti));
  }

  isRevoked(claims: Pick<DemoTokenClaims, "jti" | "iss">): boolean {
    return this.revoked.has(claims.jti) || this.revokedIssuers.has(claims.iss);
  }

  recordUse(use: DemoTokenUse): void {
    this.uses.push(use);
  }

  listIssued(): Array<DemoTokenRecord & { revoked: boolean }> {
    return this.issued.map((record) => ({ ...record, revoked: this.isRevoked(record) }));
  }

  listUses(): DemoTokenUse[] {
    return this.uses.slice();
  }

  revokedIds(): string[] {
    return [...this.revoked];
  }
}

export function isDemoTokenRevoked(claims: Pick<DemoTokenClaims, "jti" | "iss">): boolean {
  if (getDemoTokenStore().isRevoked(claims)) return true;
  const ids = (process.env.DEMO_TOKEN_REVOKED_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const issuers = (process.env.DEMO_TOKEN_REVOKED_ISSUERS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.includes(claims.jti) || issuers.includes(claims.iss);
}

const GLOBAL_KEY = "__rcDemoTokenStore";

export function getDemoTokenStore(): MemoryDemoTokenStore {
  const scope = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryDemoTokenStore };
  if (!scope[GLOBAL_KEY]) scope[GLOBAL_KEY] = new MemoryDemoTokenStore();
  return scope[GLOBAL_KEY];
}

export function resetDemoTokenStoreForTests(): void {
  const scope = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryDemoTokenStore };
  scope[GLOBAL_KEY] = new MemoryDemoTokenStore();
}

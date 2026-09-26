/**
 * Sales enablement persistence.
 * Uses Dynamo when table env vars are set; otherwise in-memory (dev / pre-infra).
 */

type MemoryDb = {
  roi: Map<string, Record<string, unknown>>;
  activity: Map<string, Record<string, unknown>[]>;
  claims: Map<string, Record<string, unknown>>;
  rfp: Map<string, Record<string, unknown>>;
  freeTier: Map<string, Record<string, unknown>>;
};

const g = globalThis as typeof globalThis & { __nexcortSalesMem?: MemoryDb };

function mem(): MemoryDb {
  if (!g.__nexcortSalesMem) {
    g.__nexcortSalesMem = {
      roi: new Map(),
      activity: new Map(),
      claims: new Map(),
      rfp: new Map(),
      freeTier: new Map(),
    };
  }
  return g.__nexcortSalesMem;
}

export function salesTablesConfigured(): boolean {
  return Boolean(
    process.env.ROI_SESSIONS_TABLE_NAME ||
      process.env.SALES_ACTIVITY_TABLE_NAME ||
      process.env.SALES_CLAIMS_TABLE_NAME ||
      process.env.SALES_RFP_TABLE_NAME ||
      process.env.FREE_TIER_REGISTRATIONS_TABLE_NAME,
  );
}

export async function putRoiSession(item: Record<string, unknown>): Promise<void> {
  const token = String(item.roiToken ?? "");
  mem().roi.set(token, item);
}

export async function getRoiSession(token: string): Promise<Record<string, unknown> | null> {
  return mem().roi.get(token) ?? null;
}

export async function putActivityReport(
  contractorEmail: string,
  item: Record<string, unknown>,
): Promise<void> {
  const list = mem().activity.get(contractorEmail) ?? [];
  const weekOf = String(item.weekOf ?? "");
  const next = list.filter((x) => String(x.weekOf) !== weekOf);
  next.unshift(item);
  mem().activity.set(contractorEmail, next.slice(0, 52));
}

export async function listActivityReports(contractorEmail: string): Promise<Record<string, unknown>[]> {
  return mem().activity.get(contractorEmail) ?? [];
}

export async function putClaim(item: Record<string, unknown>): Promise<void> {
  const slug = String(item.agencySlug ?? "");
  mem().claims.set(slug, item);
}

export async function deleteClaim(agencySlug: string, email: string): Promise<boolean> {
  const existing = mem().claims.get(agencySlug);
  if (!existing) return false;
  if (String(existing.claimedByEmail).toLowerCase() !== email.toLowerCase()) return false;
  mem().claims.delete(agencySlug);
  return true;
}

export async function listClaims(): Promise<Record<string, unknown>[]> {
  return [...mem().claims.values()];
}

export async function putRfp(item: Record<string, unknown>): Promise<void> {
  mem().rfp.set(String(item.rfpId), item);
}

export async function getRfp(rfpId: string): Promise<Record<string, unknown> | null> {
  return mem().rfp.get(rfpId) ?? null;
}

export async function deleteRfp(rfpId: string): Promise<void> {
  mem().rfp.delete(rfpId);
}

export async function listRfps(): Promise<Record<string, unknown>[]> {
  return [...mem().rfp.values()].sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
}

export async function putFreeTierRegistration(item: Record<string, unknown>): Promise<void> {
  mem().freeTier.set(String(item.registrationId), item);
}

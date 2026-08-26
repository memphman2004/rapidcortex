import type { AgencyTenant, QRLocation } from "rapid-cortex-shared";
import { fetchAgencies } from "@/lib/api";
import { fetchLocations } from "@/lib/locations-api";
import { resolveAgencyVerticalFromTenant } from "@/lib/vertical";

const FETCH_CONCURRENCY = 4;

type LocationQrUsageDeps = {
  fetchAgenciesFn: () => Promise<AgencyTenant[]>;
  fetchLocationsFn: (agencyId: string) => Promise<QRLocation[]>;
};

const defaultDeps: LocationQrUsageDeps = {
  fetchAgenciesFn: fetchAgencies,
  fetchLocationsFn: (agencyId) => fetchLocations(agencyId),
};

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]!);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

/**
 * Load Location QR (RCLI) scan points for usage totals.
 * Global view fans out to campus/venue tenants; agency view loads one tenant.
 */
export async function loadLocationQrUsage(
  opts: { globalView: boolean; agencyId: string },
  deps: LocationQrUsageDeps = defaultDeps,
): Promise<{ locations: QRLocation[]; agencyCount: number; error?: string }> {
  try {
    if (!opts.globalView) {
      const agencyId = opts.agencyId.trim();
      if (!agencyId) return { locations: [], agencyCount: 0 };
      const locations = await deps.fetchLocationsFn(agencyId);
      return { locations, agencyCount: 1 };
    }
    const agencies = await deps.fetchAgenciesFn();
    const targets = agencies.filter((agency) => {
      const vertical = resolveAgencyVerticalFromTenant(agency);
      return vertical === "campus" || vertical === "venue";
    });
    const batches = await mapPool(targets, FETCH_CONCURRENCY, async (agency) => {
      try {
        return await deps.fetchLocationsFn(agency.agencyId);
      } catch {
        return [] as QRLocation[];
      }
    });
    return { locations: batches.flat(), agencyCount: targets.length };
  } catch (error) {
    return {
      locations: [],
      agencyCount: 0,
      error: error instanceof Error ? error.message : "Failed to load location QR scans",
    };
  }
}

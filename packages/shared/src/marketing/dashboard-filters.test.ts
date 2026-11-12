import { describe, it, expect } from "vitest";
import {
  resolveMarketingProductMarket,
  verticalsForProductMarket,
  resolveSalesZoneForState,
  parseMarketingDashboardFilter,
  serializeMarketingDashboardFilter,
  PRODUCT_MARKETS,
  MARKETING_ZONE_IDS,
} from "./dashboard-filters.js";

describe("resolveMarketingProductMarket", () => {
  it("maps rc911 to psap", () => {
    expect(resolveMarketingProductMarket("rc911")).toBe("psap");
  });

  it("maps law_enforcement to psap", () => {
    expect(resolveMarketingProductMarket("law_enforcement")).toBe("psap");
  });

  it("maps fire_ems to psap", () => {
    expect(resolveMarketingProductMarket("fire_ems")).toBe("psap");
  });

  it("maps campus to campus", () => {
    expect(resolveMarketingProductMarket("campus")).toBe("campus");
  });

  it("maps venue to venue", () => {
    expect(resolveMarketingProductMarket("venue")).toBe("venue");
  });

  it("maps transit to transit", () => {
    expect(resolveMarketingProductMarket("transit")).toBe("transit");
  });

  it("returns null for unknown vertical", () => {
    expect(resolveMarketingProductMarket("unknown")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(resolveMarketingProductMarket(null)).toBeNull();
    expect(resolveMarketingProductMarket(undefined)).toBeNull();
  });
});

describe("verticalsForProductMarket", () => {
  it("returns PSAP verticals for psap market", () => {
    const v = verticalsForProductMarket("psap");
    expect(v).toContain("rc911");
    expect(v).toContain("law_enforcement");
    expect(v).toContain("fire_ems");
  });

  it("returns campus for campus market", () => {
    expect(verticalsForProductMarket("campus")).toContain("campus");
  });

  it("round-trips with resolveMarketingProductMarket", () => {
    for (const market of PRODUCT_MARKETS) {
      const verticals = verticalsForProductMarket(market);
      for (const v of verticals) {
        expect(resolveMarketingProductMarket(v)).toBe(market);
      }
    }
  });
});

describe("resolveSalesZoneForState", () => {
  it("resolves TX to zone-1", () => {
    expect(resolveSalesZoneForState("TX")).toBe("zone-1");
  });

  it("resolves CA to zone-3", () => {
    expect(resolveSalesZoneForState("CA")).toBe("zone-3");
  });

  it("resolves FL to zone-2", () => {
    expect(resolveSalesZoneForState("FL")).toBe("zone-2");
  });

  it("resolves KY to zone-4", () => {
    expect(resolveSalesZoneForState("KY")).toBe("zone-4");
  });

  it("resolves MT to zone-6", () => {
    expect(resolveSalesZoneForState("MT")).toBe("zone-6");
  });

  it("is case-insensitive", () => {
    expect(resolveSalesZoneForState("tx")).toBe("zone-1");
    expect(resolveSalesZoneForState("ca")).toBe("zone-3");
  });

  it("returns null for unknown state", () => {
    expect(resolveSalesZoneForState("ZZ")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(resolveSalesZoneForState(null)).toBeNull();
    expect(resolveSalesZoneForState(undefined)).toBeNull();
  });

  it("returns a valid MarketingZoneId for all listed states", () => {
    const validZones = new Set(MARKETING_ZONE_IDS);
    // sample from each zone
    const samples = ["TX", "FL", "CA", "KY", "MT", "AK"];
    for (const state of samples) {
      const zone = resolveSalesZoneForState(state);
      expect(zone).not.toBeNull();
      if (zone) expect(validZones.has(zone)).toBe(true);
    }
  });
});

describe("parseMarketingDashboardFilter", () => {
  it("parses valid productMarket", () => {
    const f = parseMarketingDashboardFilter({ productMarket: "campus" });
    expect(f.productMarket).toBe("campus");
  });

  it("parses valid zoneId", () => {
    const f = parseMarketingDashboardFilter({ zoneId: "zone-3" });
    expect(f.zoneId).toBe("zone-3");
  });

  it("returns empty object for invalid values (graceful)", () => {
    const f = parseMarketingDashboardFilter({ productMarket: "invalid-market" });
    expect(f.productMarket).toBeUndefined();
  });

  it("ignores undefined values", () => {
    const f = parseMarketingDashboardFilter({});
    expect(f.productMarket).toBeUndefined();
    expect(f.zoneId).toBeUndefined();
  });

  it("uppercases state code", () => {
    const f = parseMarketingDashboardFilter({ state: "ca" });
    expect(f.state).toBe("CA");
  });
});

describe("serializeMarketingDashboardFilter", () => {
  it("serializes productMarket and zoneId", () => {
    const qs = serializeMarketingDashboardFilter({ productMarket: "venue", zoneId: "zone-2" });
    expect(qs.get("productMarket")).toBe("venue");
    expect(qs.get("zoneId")).toBe("zone-2");
  });

  it("omits undefined values", () => {
    const qs = serializeMarketingDashboardFilter({ productMarket: undefined });
    expect(qs.toString()).toBe("");
  });

  it("round-trips parse → serialize → parse", () => {
    const original = { productMarket: "psap" as const, zoneId: "zone-1" as const, state: "TX" };
    const qs = serializeMarketingDashboardFilter(original);
    const params: Record<string, string> = {};
    qs.forEach((v, k) => { params[k] = v; });
    const reparsed = parseMarketingDashboardFilter(params);
    expect(reparsed.productMarket).toBe(original.productMarket);
    expect(reparsed.zoneId).toBe(original.zoneId);
    expect(reparsed.state).toBe(original.state);
  });
});

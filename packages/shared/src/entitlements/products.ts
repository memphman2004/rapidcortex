import { z } from "zod";

/**
 * Licensed NexCort iQ products. Extend this union as products launch.
 * Stored on the agency record. Never written into the Cognito JWT.
 * CareTally iQ Emergency Link is not part of this model.
 */
export const NEXCORTIQ_PRODUCTS = [
  "NEXCORT_CORE",
  "NEXCORT_CAD",
  "NEXCORT_RMS",
  "NEXCORT_RESPONDER",
] as const;

export type NexCortiQProduct = (typeof NEXCORTIQ_PRODUCTS)[number];

export const PRODUCT_LABELS: Record<NexCortiQProduct, string> = {
  NEXCORT_CORE: "NexCort iQ Core (AI Communications & Intelligence)",
  NEXCORT_CAD: "NexCort iQ CAD (Computer-Aided Dispatch)",
  NEXCORT_RMS: "NexCort iQ RMS (Records Management)",
  NEXCORT_RESPONDER: "NexCort iQ Responder (Mobile Field App)",
};

export interface AgencyEntitlements {
  products: NexCortiQProduct[];
  /** ISO-8601 */
  enabledAt?: string;
  /** Platform admin user id */
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export type DeploymentConfig = "CORE_ONLY" | "CAD_ONLY" | "UNIFIED" | "NONE";

export const agencyEntitlementsSchema = z.object({
  products: z.array(z.enum(NEXCORTIQ_PRODUCTS)),
  enabledAt: z.string().optional(),
  lastModifiedBy: z.string().optional(),
  lastModifiedAt: z.string().optional(),
});

/** Use these predicates. Components do not scan the products array themselves. */
export function hasCore(entitlements: AgencyEntitlements): boolean {
  return entitlements.products.includes("NEXCORT_CORE");
}

export function hasCAD(entitlements: AgencyEntitlements): boolean {
  return entitlements.products.includes("NEXCORT_CAD");
}

export function hasRMS(entitlements: AgencyEntitlements): boolean {
  return entitlements.products.includes("NEXCORT_RMS");
}

export function hasResponder(entitlements: AgencyEntitlements): boolean {
  return entitlements.products.includes("NEXCORT_RESPONDER");
}

export function hasUnifiedWorkspace(entitlements: AgencyEntitlements): boolean {
  return hasCore(entitlements) && hasCAD(entitlements);
}

export function getDeploymentConfig(entitlements: AgencyEntitlements): DeploymentConfig {
  const core = hasCore(entitlements);
  const cad = hasCAD(entitlements);
  if (core && cad) return "UNIFIED";
  if (core) return "CORE_ONLY";
  if (cad) return "CAD_ONLY";
  return "NONE";
}

/**
 * Missing attribute on a row written before product licenses existed.
 * An explicit empty list is `{ products: [] }`, which is NONE.
 * A missing attribute stays Core, so existing agencies keep the intelligence shell.
 */
export function readAgencyEntitlements(stored: AgencyEntitlements | undefined): AgencyEntitlements {
  if (!stored) return { products: ["NEXCORT_CORE"] };
  return { ...stored, products: [...stored.products] };
}

export type SessionProductEntitlements = {
  products: NexCortiQProduct[];
  config: DeploymentConfig;
};

/** Session payload field. Do not copy this onto the JWT. */
export function sessionProductEntitlements(
  stored: AgencyEntitlements | undefined,
): SessionProductEntitlements {
  const entitlements = readAgencyEntitlements(stored);
  return {
    products: entitlements.products,
    config: getDeploymentConfig(entitlements),
  };
}

export type ProductLicenseChange = {
  previous: NexCortiQProduct[];
  updated: NexCortiQProduct[];
  added: NexCortiQProduct[];
  removed: NexCortiQProduct[];
};

export function productLicenseChange(
  previous: NexCortiQProduct[],
  updated: NexCortiQProduct[],
): ProductLicenseChange {
  return {
    previous: [...previous],
    updated: [...updated],
    added: updated.filter((product) => !previous.includes(product)),
    removed: previous.filter((product) => !updated.includes(product)),
  };
}

export type ProductDenial = {
  error: string;
  code: "PRODUCT_NOT_LICENSED";
  product: NexCortiQProduct;
};

export function productDenial(product: NexCortiQProduct): ProductDenial {
  return {
    error: `Your agency does not have a license for ${product}`,
    code: "PRODUCT_NOT_LICENSED",
    product,
  };
}

/**
 * License check for one agency. The agency id comes from the verified session,
 * not from the URL. Returns a denial when that agency's list omits the product.
 */
export function decideProductAccess(
  entitlements: AgencyEntitlements,
  product: NexCortiQProduct,
): { allowed: true } | { allowed: false; denial: ProductDenial } {
  if (entitlements.products.includes(product)) return { allowed: true };
  return { allowed: false, denial: productDenial(product) };
}

export type ServiceHealth = "connected" | "degraded" | "disconnected";
export type ProductService = "core" | "cad" | "rms";

const SERVICE_PRODUCT: Record<ProductService, NexCortiQProduct> = {
  core: "NEXCORT_CORE",
  cad: "NEXCORT_CAD",
  rms: "NEXCORT_RMS",
};

/** Licensed products that keep running when one sibling service is down. */
export function productsThatContinue(
  entitlements: AgencyEntitlements,
  down: ProductService,
): NexCortiQProduct[] {
  const stopped = SERVICE_PRODUCT[down];
  return entitlements.products.filter((product) => product !== stopped);
}

export type DashboardTileId =
  | "dispatch-workspace"
  | "active-calls"
  | "live-transcripts"
  | "video-feeds"
  | "open-incidents"
  | "units-active"
  | "pending-reports";

export type DashboardLayout = {
  config: DeploymentConfig;
  columns: 2 | 3;
  hero: "dispatch-workspace" | null;
  tiles: DashboardTileId[];
};

/** Tiles for licensed products only. No cell is reserved for an unlicensed product. */
export function dashboardLayout(entitlements: AgencyEntitlements): DashboardLayout {
  const config = getDeploymentConfig(entitlements);
  const tiles: DashboardTileId[] = [];
  if (hasCore(entitlements)) {
    tiles.push("active-calls", "live-transcripts", "video-feeds");
  }
  if (hasCAD(entitlements)) {
    tiles.push("open-incidents", "units-active");
  }
  if (hasRMS(entitlements)) {
    tiles.push("pending-reports");
  }
  const hero = hasCAD(entitlements) ? "dispatch-workspace" : null;
  return {
    config,
    columns: config === "CORE_ONLY" ? 2 : 3,
    hero: config === "NONE" ? null : hero,
    tiles: config === "NONE" ? [] : tiles,
  };
}

export type ProductNavDecision = "hidden" | "shown" | "degraded";

/**
 * Unlicensed products are omitted. A licensed product that is down stays visible
 * with a degraded badge. Responder also requires CAD.
 */
export function productNavDecision(
  product: NexCortiQProduct | undefined,
  entitlements: AgencyEntitlements,
  health: ServiceHealth = "connected",
): ProductNavDecision {
  if (!product) return "shown";
  if (!entitlements.products.includes(product)) return "hidden";
  if (product === "NEXCORT_RESPONDER" && !hasCAD(entitlements)) return "hidden";
  if (health === "degraded" || health === "disconnected") return "degraded";
  return "shown";
}

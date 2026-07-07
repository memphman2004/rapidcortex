import { PRICING_DEFAULTS, type PricingKey } from "./pricing-defaults";
import type { PricingOverrides } from "./pricing-types";

export function effectivePrice(
  key: PricingKey,
  globalOverrides: PricingOverrides,
  tenantOverrides?: PricingOverrides,
): number {
  if (tenantOverrides?.[key] !== undefined) return tenantOverrides[key];
  if (globalOverrides[key] !== undefined) return globalOverrides[key];
  return PRICING_DEFAULTS[key];
}

export function isDefaultValue(key: PricingKey, value: number): boolean {
  return value === PRICING_DEFAULTS[key];
}

export function isTenantOverride(
  key: PricingKey,
  tenantOverrides?: PricingOverrides,
): boolean {
  return tenantOverrides?.[key] !== undefined;
}

export function isGlobalOverride(
  key: PricingKey,
  globalOverrides: PricingOverrides,
): boolean {
  return (
    globalOverrides[key] !== undefined &&
    globalOverrides[key] !== PRICING_DEFAULTS[key]
  );
}

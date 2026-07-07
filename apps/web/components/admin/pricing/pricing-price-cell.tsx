"use client";

import { PriceField } from "./price-field";
import type { TabProps } from "@/lib/pricing/pricing-catalog";

type PricingPriceCellProps = Pick<TabProps, "editMode" | "onStage" | "onRevert" | "getFieldProps"> & {
  priceKey: string;
  suffix?: string;
  decimals?: number;
};

export function PricingPriceCell({
  priceKey,
  suffix,
  decimals,
  editMode,
  onStage,
  onRevert,
  getFieldProps,
}: PricingPriceCellProps) {
  const computed = getFieldProps(priceKey, { suffix, decimals });
  return (
    <PriceField
      priceKey={priceKey}
      editMode={editMode}
      onStage={onStage}
      onRevert={onRevert}
      suffix={suffix}
      decimals={decimals}
      stagedValue={computed.stagedValue}
      effectiveValue={computed.effectiveValue}
      defaultValue={computed.defaultValue}
      isGlobalOverride={computed.isGlobalOverride}
      isTenantOverride={computed.isTenantOverride}
    />
  );
}

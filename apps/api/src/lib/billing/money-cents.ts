/**
 * Financial amounts are stored as integer cents (billing-audit H7).
 * API/UI may still submit dollars — convert at the write boundary.
 */

export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars)) return 0;
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Number((cents / 100).toFixed(2));
}

export function computeTotalsCents(input: {
  lineItems: Array<{ quantity: number; unitPriceDollars: number }>;
  discountDollars?: number;
  taxDollars?: number;
}): {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  /** Legacy dollar mirrors for older UI readers. */
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
} {
  const subtotalCents = input.lineItems.reduce(
    (sum, item) => sum + dollarsToCents(item.quantity * item.unitPriceDollars),
    0,
  );
  const discountCents = dollarsToCents(input.discountDollars ?? 0);
  const taxCents = dollarsToCents(input.taxDollars ?? 0);
  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);
  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents,
    subtotal: centsToDollars(subtotalCents),
    discount: centsToDollars(discountCents),
    tax: centsToDollars(taxCents),
    total: centsToDollars(totalCents),
  };
}

/** Prefer *Cents fields when present; fall back to dollar floats. */
export function resolveAmountDollars(row: {
  amountCents?: unknown;
  amount?: unknown;
  totalCents?: unknown;
  total?: unknown;
  subtotalCents?: unknown;
  subtotal?: unknown;
  unitPriceCents?: unknown;
  unitPrice?: unknown;
  lineTotalCents?: unknown;
  lineTotal?: unknown;
}, field: "total" | "subtotal" | "unitPrice" | "lineTotal" | "amount" = "total"): number {
  const centsKey = `${field}Cents` as keyof typeof row;
  const dollarsKey = field as keyof typeof row;
  const centsVal = row[centsKey];
  if (typeof centsVal === "number" && Number.isFinite(centsVal)) {
    return centsToDollars(centsVal);
  }
  const dollarsVal = row[dollarsKey];
  if (typeof dollarsVal === "number" && Number.isFinite(dollarsVal)) {
    return dollarsVal;
  }
  return 0;
}

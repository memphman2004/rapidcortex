import { env } from "../../lib/env.js";

export function automatedInvoicesTable(): string {
  const name = env.automatedInvoicesTable;
  if (!name) throw new Error("Missing AUTOMATED_INVOICES_TABLE");
  return name;
}

export function agencyBillingConfigsTable(): string {
  const name = env.agencyBillingConfigsTable;
  if (!name) throw new Error("Missing AGENCY_BILLING_CONFIGS_TABLE");
  return name;
}

export function usageSnapshotsTable(): string {
  const name = env.usageSnapshotsTable;
  if (!name) throw new Error("Missing USAGE_SNAPSHOTS_TABLE");
  return name;
}

export function billingRunsTable(): string {
  const name = env.billingRunsTable;
  if (!name) throw new Error("Missing BILLING_RUNS_TABLE");
  return name;
}

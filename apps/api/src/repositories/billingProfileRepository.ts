import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type {
  AgencyBillingProfile,
  BillingAccount,
  InvoiceRecord,
  PaymentMethod,
  SubscriptionPlanAssignment,
} from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

function migrateLegacyExternalIds(profile: AgencyBillingProfile): AgencyBillingProfile {
  let billingAccount: BillingAccount = { ...profile.billingAccount };
  const bc = profile.billingAccount as unknown as Record<string, unknown>;
  if (
    typeof bc["squareCustomerId"] === "string" &&
    bc["squareCustomerId"].trim() &&
    !billingAccount.archivedExternalCustomerId
  ) {
    billingAccount = { ...billingAccount, archivedExternalCustomerId: bc["squareCustomerId"].trim() };
  }

  let subscription: SubscriptionPlanAssignment | undefined = profile.subscription;
  if (subscription) {
    const sub = subscription as unknown as Record<string, unknown>;
    if (
      typeof sub["squareSubscriptionId"] === "string" &&
      sub["squareSubscriptionId"].trim() &&
      !subscription.archivedExternalSubscriptionId
    ) {
      subscription = {
        ...subscription,
        archivedExternalSubscriptionId: sub["squareSubscriptionId"].trim(),
      };
    }
  }

  const invoices: InvoiceRecord[] = (profile.invoices ?? []).map((inv) => {
    const i = inv as unknown as Record<string, unknown>;
    if (
      typeof i["squareInvoiceId"] === "string" &&
      i["squareInvoiceId"].trim() &&
      !inv.archivedExternalInvoiceId
    ) {
      return { ...inv, archivedExternalInvoiceId: i["squareInvoiceId"].trim() };
    }
    return inv;
  });

  const paymentMethods: PaymentMethod[] = (profile.paymentMethods ?? []).map((pm) => {
    const m = pm as unknown as Record<string, unknown>;
    if (
      typeof m["squarePaymentMethodId"] === "string" &&
      m["squarePaymentMethodId"].trim() &&
      !pm.archivedExternalPaymentMethodRef
    ) {
      return { ...pm, archivedExternalPaymentMethodRef: m["squarePaymentMethodId"].trim() };
    }
    return pm;
  });

  return {
    ...profile,
    billingAccount,
    ...(subscription !== undefined ? { subscription } : {}),
    invoices,
    paymentMethods,
  };
}

export class BillingProfileRepository {
  async get(agencyId: string): Promise<AgencyBillingProfile | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: env.billingProfilesTable,
        Key: { agencyId },
      }),
    );
    const item = res.Item as AgencyBillingProfile | undefined;
    if (!item) return null;
    return migrateLegacyExternalIds(item);
  }

  async put(profile: AgencyBillingProfile): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.billingProfilesTable,
        Item: profile,
      }),
    );
  }
}

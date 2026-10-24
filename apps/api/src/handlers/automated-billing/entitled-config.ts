import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  billingConfigWithEntitledAddons,
  type AgencyBillingConfig,
  type TenantEntitlements,
} from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { ddb } from "../../repositories/baseRepository.js";

/**
 * Apply the agency products page to the billing config used by the monthly invoice.
 * Missing profile data leaves the stored add-on list unchanged.
 */
export async function configWithProductAddons(config: AgencyBillingConfig): Promise<AgencyBillingConfig> {
  const table = env.billingProfilesTable;
  if (!table) return config;
  if (!config.agencyId) return config;

  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { agencyId: config.agencyId },
    }),
  );
  const item = res.Item as { agencyId?: string; tenantEntitlements?: TenantEntitlements } | undefined;
  if (!item) return config;
  if (item.agencyId && item.agencyId !== config.agencyId) return config;

  return billingConfigWithEntitledAddons(config, item.tenantEntitlements, new Date().toISOString());
}

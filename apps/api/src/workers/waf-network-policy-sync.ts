import type { SNSEvent } from "aws-lambda";
import { defaultAgencyNetworkPolicy } from "rapid-cortex-shared";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { syncAgencyNetworkPolicyToWaf } from "../services/wafNetworkPolicySyncService.js";

const agencyRepo = new AgencyRepository();

function log(msg: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ msg, ...extra }));
}

/**
 * SNS payload: { "agencyId": "..." }
 */
export async function handler(event: SNSEvent): Promise<void> {
  for (const record of event.Records) {
    let agencyId = "";
    try {
      const body = JSON.parse(record.Sns.Message) as { agencyId?: string };
      agencyId = String(body.agencyId ?? "").trim();
      if (!agencyId) continue;

      const agency = await agencyRepo.get(agencyId);
      if (!agency) continue;

      const policy = agency.networkPolicy ?? defaultAgencyNetworkPolicy();
      const syncing = {
        ...policy,
        wafSyncStatus: "syncing" as const,
        wafSyncedAt: new Date().toISOString(),
      };
      await agencyRepo.put({
        ...agency,
        updatedAt: syncing.wafSyncedAt ?? new Date().toISOString(),
        networkPolicy: syncing,
      });

      const outcome = await syncAgencyNetworkPolicyToWaf(agencyId, policy);
      const next = { ...policy, ...outcome };
      await agencyRepo.put({
        ...agency,
        updatedAt: outcome.wafSyncedAt ?? new Date().toISOString(),
        networkPolicy: next,
      });
      log("waf_sync_complete", { agencyId, wafSyncStatus: next.wafSyncStatus });
    } catch (e) {
      log("waf_sync_error", { agencyId, err: e instanceof Error ? e.message : String(e) });
      try {
        const agency = await agencyRepo.get(agencyId);
        if (!agency) continue;
        const policy = agency.networkPolicy ?? defaultAgencyNetworkPolicy();
        await agencyRepo.put({
          ...agency,
          updatedAt: new Date().toISOString(),
          networkPolicy: {
            ...policy,
            wafSyncStatus: "error",
            wafSyncedAt: new Date().toISOString(),
          },
        });
      } catch {
        /* ignore secondary failure */
      }
    }
  }
}

import type { UsageTotals } from "rapid-cortex-shared";
import { calculateOverages } from "rapid-cortex-shared";
import { UsageMeterRepository } from "../../repositories/usageMeterRepository.js";

const repo = new UsageMeterRepository();

/**
 * Usage must be incremented only from trusted backend paths (Lambdas).
 */
export class UsageMeterService {
  async recordIncidentCreated(agencyId: string, billingPeriod?: string): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "incidentCount", 1);
  }

  async recordApiCall(
    agencyId: string,
    _apiClientId: string | undefined,
    billingPeriod?: string,
  ): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "apiCallCount", 1);
  }

  async recordFailedApiCall(agencyId: string, billingPeriod?: string): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "failedApiCalls", 1);
  }

  async recordAiSummary(agencyId: string, _incidentId: string, billingPeriod?: string): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "aiSummaryCount", 1);
  }

  async recordTranscriptionMinutes(agencyId: string, minutes: number, billingPeriod?: string): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "transcriptionMinutes", Math.max(0, minutes));
  }

  async recordTranslationMinutes(agencyId: string, minutes: number, billingPeriod?: string): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "translationMinutes", Math.max(0, minutes));
  }

  async recordMediaSession(agencyId: string, _mediaType: string, billingPeriod?: string): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "mediaSessionCount", 1);
  }

  async recordCadExport(agencyId: string, _incidentId: string, billingPeriod?: string): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "cadExportCount", 1);
  }

  async recordWebhookDelivery(agencyId: string, _webhookId: string, billingPeriod?: string): Promise<void> {
    await repo.incrementField(agencyId, billingPeriod, "webhookDeliveryCount", 1);
  }

  async getUsageForBillingPeriod(agencyId: string, period?: string): Promise<UsageTotals | null> {
    const row = await repo.getAggregate(agencyId, period);
    if (!row) return null;
    return {
      incidentCount: row.incidentCount ?? 0,
      apiCallCount: row.apiCallCount ?? 0,
      aiSummaryCount: row.aiSummaryCount ?? 0,
      transcriptionMinutes: row.transcriptionMinutes ?? 0,
      translationMinutes: row.translationMinutes ?? 0,
      mediaSessionCount: row.mediaSessionCount ?? 0,
      cadExportCount: row.cadExportCount ?? 0,
      webhookDeliveryCount: row.webhookDeliveryCount ?? 0,
      storageGb: row.storageGb ?? 0,
    };
  }

  calculateOverages(used: UsageTotals, included: import("rapid-cortex-shared").IncludedQuotas) {
    return calculateOverages(used, included);
  }
}

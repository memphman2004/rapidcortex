/**
 * Compatibility aliases: product UI still uses NexiQ* names while shared
 * schemas/types are RapidIq*. Keep until the web rename is finished.
 */
export type {
  RapidIqContact as NexiQContact,
  RapidIqOpportunity as NexiQOpportunity,
  RapidIqSignal as NexiQSignal,
  RapidIqSource as NexiQSource,
  RapidIqVertical as NexiQVertical,
} from "./schemas.js";

export type {
  RapidIqAgencyContact as NexiQAgencyContact,
  RapidIqAgencyProfile as NexiQAgencyProfile,
  RapidIqPipelineCreditsResponse as NexiQPipelineCreditsResponse,
  RapidIqPipelineSignal as NexiQPipelineSignal,
  RapidIqPipelineSignalStatus as NexiQPipelineSignalStatus,
  RapidIqResearchRequest as NexiQResearchRequest,
  RapidIqResearchResponse as NexiQResearchResponse,
  CreateManualRapidIqPipelineSignalBody as CreateManualNexiQPipelineSignalBody,
  EnqueueRapidIqPipelineFromOpportunityBody as EnqueueNexiQPipelineFromOpportunityBody,
  PatchRapidIqPipelineSignalBody as PatchNexiQPipelineSignalBody,
  PushRapidIqPipelineToCrmBody as PushNexiQPipelineToCrmBody,
} from "./pipeline-schemas.js";

export type {
  RapidIqIntelBidNoBid as NexiQIntelBidNoBid,
  RapidIqIntelOpportunity as NexiQIntelOpportunity,
  RapidIqIntelOutreachAudience as NexiQIntelOutreachAudience,
  RapidIqIntelPursuitBrief as NexiQIntelPursuitBrief,
  RapidIqIntelWatch as NexiQIntelWatch,
} from "./opportunity-intel-schemas.js";

export type {
  RapidIqOutlookStatus as NexiQOutlookStatus,
  RapidIqSalesBulkApproveResult as NexiQSalesBulkApproveResult,
  RapidIqSalesBulkBatch as NexiQSalesBulkBatch,
  RapidIqSalesBulkResult as NexiQSalesBulkResult,
  RapidIqSalesCampaignCard as NexiQSalesCampaignCard,
  RapidIqSalesContentDraft as NexiQSalesContentDraft,
  RapidIqSalesMetrics as NexiQSalesMetrics,
  RapidIqSalesSequence as NexiQSalesSequence,
  CreateRapidIqSalesBulkCampaignBody as CreateNexiQSalesBulkCampaignBody,
  CreateRapidIqSalesSequenceBody as CreateNexiQSalesSequenceBody,
  UpdateRapidIqSalesDraftBody as UpdateNexiQSalesDraftBody,
  UpdateRapidIqSalesSequenceBody as UpdateNexiQSalesSequenceBody,
} from "./sales-automation-schemas.js";

export type { RapidIqRfpCountSnapshot as NexiQRfpCountSnapshot } from "./rfp-unified-count.js";

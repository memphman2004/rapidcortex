/**
 * SQS-triggered processor: dedup → NLP extract → two-score + evidence → DynamoDB.
 * Scoring lives here (not in ingest Lambdas). Agency resolve + enrichment are
 * best-effort after put and must not fail the SQS record.
 */

import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { randomBytes } from "node:crypto";
import {
  classifyProcurementStage,
  resolveProcurementStage,
  type RapidIqPipelineRawSignal,
  type RapidIqProcurementStage,
  rapidIqPipelineRawSignalSchema,
} from "rapid-cortex-shared";
import { applySignalIntelligence } from "../../../lib/rapid-iq/pipeline/apply-signal-intelligence.js";
import { enrichAgencyIntelligence } from "../../../lib/rapid-iq/pipeline/enrich-agency-contacts.js";
import { computeFitScore } from "../../../lib/rapid-iq/pipeline/fit-scorer.js";
import { extractSignalData } from "../../../lib/rapid-iq/pipeline/nlp-extract.js";
import {
  contentHash,
  putSignal,
  reserveHash,
  signalExistsByHash,
} from "../../../lib/rapid-iq/pipeline/rapid-iq-pipeline-db.js";
import { resolveAgency } from "../../../lib/rapid-iq/pipeline/resolve-agency.js";

function newSignalId(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

function snippetMeta(rawSnippet: string): {
  procurementStage?: RapidIqProcurementStage;
  competitorName?: string;
  competitorProduct?: string;
  estimatedContractEnd?: string;
  agencyName?: string;
  dollarAmount?: number;
} {
  try {
    const parsed = JSON.parse(rawSnippet) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const stage = parsed.procurementStage;
    return {
      procurementStage:
        typeof stage === "string" ? (stage as RapidIqProcurementStage) : undefined,
      competitorName: typeof parsed.competitorName === "string" ? parsed.competitorName : undefined,
      competitorProduct:
        typeof parsed.competitorProduct === "string" ? parsed.competitorProduct : undefined,
      estimatedContractEnd:
        typeof parsed.estimatedContractEnd === "string" ? parsed.estimatedContractEnd : undefined,
      agencyName: typeof parsed.agencyName === "string" ? parsed.agencyName : undefined,
      dollarAmount:
        typeof parsed.dollarAmount === "number"
          ? parsed.dollarAmount
          : typeof parsed.awardCeiling === "number"
            ? parsed.awardCeiling
            : undefined,
    };
  } catch {
    return {};
  }
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: string[] = [];

  for (const record of event.Records) {
    try {
      const parsed = rapidIqPipelineRawSignalSchema.safeParse(JSON.parse(record.body));
      if (!parsed.success) {
        console.error("Invalid raw signal body", parsed.error.flatten());
        continue;
      }
      const raw: RapidIqPipelineRawSignal = parsed.data;
      const hash = contentHash(raw.rawTitle, raw.rawSnippet);

      if (await signalExistsByHash(hash)) {
        console.log(`Duplicate signal skipped: ${hash}`);
        continue;
      }

      const signalId = newSignalId();

      try {
        await reserveHash(hash, signalId);
      } catch {
        console.log(`Race condition on hash ${hash} — skipping`);
        continue;
      }

      const extraction = await extractSignalData(raw);
      const { score: extractScore } = computeFitScore(extraction);
      const hay = `${raw.rawTitle}\n${raw.rawSnippet}`;
      const meta = snippetMeta(raw.rawSnippet);
      const procurementStage = resolveProcurementStage({
        procurementStage: meta.procurementStage ?? classifyProcurementStage(hay),
        sourceId: raw.sourceId,
        rawTitle: raw.rawTitle,
        rawSnippet: raw.rawSnippet,
        summary: extraction.summary ?? undefined,
      });
      const now = new Date().toISOString();
      const intel = applySignalIntelligence({
        hay,
        sourceId: raw.sourceId,
        sourceUrl: raw.sourceUrl,
        signalDate: raw.signalDate,
        agencyType:
          raw.sourceId === "competitor-intel" ? "competitor_watch" : extraction.agencyType,
        sourceTitle: raw.rawTitle,
        documentDate: raw.signalDate,
        procurementStage,
        legacyExtractScore: extractScore,
      });

      const signal = {
        signalId,
        sourceId: raw.sourceId,
        sourceUrl: raw.sourceUrl,
        rawTitle: raw.rawTitle,
        rawSnippet: raw.rawSnippet.slice(0, 2000),
        contentHash: hash,
        signalDate: raw.signalDate,
        ingestedAt: now,
        processedAt: now,
        agencyName: extraction.agencyName ?? meta.agencyName,
        jurisdiction: extraction.jurisdiction,
        state: extraction.state,
        agencyType:
          raw.sourceId === "competitor-intel" ? "competitor_watch" : extraction.agencyType,
        vendorNamed: extraction.vendorNamed ?? meta.competitorName,
        fundingSource: extraction.fundingSource,
        procurementType: extraction.procurementType,
        dollarAmount: extraction.dollarAmount ?? meta.dollarAmount,
        summary: extraction.summary,
        contactHints: extraction.contactHints,
        procurementStage,
        competitorName: meta.competitorName,
        competitorProduct: meta.competitorProduct,
        estimatedContractEnd: meta.estimatedContractEnd,
        status: "new" as const,
        ...intel,
      };

      await putSignal(signal);

      try {
        const agencyId = await resolveAgency(signal);
        if (agencyId) {
          await enrichAgencyIntelligence(agencyId, { ...signal, agencyProfileId: agencyId });
        }
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "rapid_iq_agency_resolve_failed",
            signalId,
            error: err instanceof Error ? err.message : "unknown",
          }),
        );
      }

      console.log(
        JSON.stringify({
          msg: "rapid_iq_pipeline_signal_processed",
          signalId,
          score: intel.fitScore,
          combinedScore: intel.combinedScore,
          buyingIntentScore: intel.buyingIntentScore,
          productFitScore: intel.productFitScore,
          label: intel.fitLabel,
          sourceId: raw.sourceId,
        }),
      );
    } catch (err) {
      console.error("Failed to process SQS record:", err);
      failures.push(record.messageId);
    }
  }

  return {
    batchItemFailures: failures.map((id) => ({ itemIdentifier: id })),
  };
}

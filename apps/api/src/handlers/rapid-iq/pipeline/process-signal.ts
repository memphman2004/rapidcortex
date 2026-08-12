/**
 * SQS-triggered processor: dedup → NLP extract → fit score → DynamoDB.
 */

import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { randomBytes } from "node:crypto";
import {
  rapidIqPipelineRawSignalSchema,
  type RapidIqPipelineRawSignal,
} from "rapid-cortex-shared";
import { computeFitScore } from "../../../lib/rapid-iq/pipeline/fit-scorer.js";
import { extractSignalData } from "../../../lib/rapid-iq/pipeline/nlp-extract.js";
import {
  contentHash,
  putSignal,
  reserveHash,
  signalExistsByHash,
} from "../../../lib/rapid-iq/pipeline/rapid-iq-pipeline-db.js";

function newSignalId(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
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
      const { score, label } = computeFitScore(extraction);
      const now = new Date().toISOString();

      await putSignal({
        signalId,
        sourceId: raw.sourceId,
        sourceUrl: raw.sourceUrl,
        rawTitle: raw.rawTitle,
        rawSnippet: raw.rawSnippet.slice(0, 2000),
        contentHash: hash,
        signalDate: raw.signalDate,
        ingestedAt: now,
        processedAt: now,
        agencyName: extraction.agencyName,
        jurisdiction: extraction.jurisdiction,
        state: extraction.state,
        agencyType: extraction.agencyType,
        vendorNamed: extraction.vendorNamed,
        fundingSource: extraction.fundingSource,
        procurementType: extraction.procurementType,
        dollarAmount: extraction.dollarAmount,
        summary: extraction.summary,
        contactHints: extraction.contactHints,
        fitScore: score,
        fitLabel: label,
        status: "new",
      });

      console.log(
        JSON.stringify({
          msg: "rapid_iq_pipeline_signal_processed",
          signalId,
          score,
          label,
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

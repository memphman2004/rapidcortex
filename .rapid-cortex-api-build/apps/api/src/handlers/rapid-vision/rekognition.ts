import type { KinesisStreamHandler } from "aws-lambda";

/**
 * Rekognition Connected Home events land here in Phase 2.
 * Phase 1 drops records that have no active Rapid Vision™ session — fail closed.
 */
export const handler: KinesisStreamHandler = async (event) => {
  for (const record of event.Records ?? []) {
    try {
      const payload = Buffer.from(record.kinesis.data, "base64").toString("utf8");
      if (!payload) continue;
      console.info(JSON.stringify({ msg: "vision_rekognition_record_ignored_phase1" }));
    } catch {
      /* never throw — Rekognition without a session is dropped */
    }
  }
};

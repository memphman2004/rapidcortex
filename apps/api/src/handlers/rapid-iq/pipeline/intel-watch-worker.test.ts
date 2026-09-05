import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SQSEvent } from "aws-lambda";

const processWatch = vi.fn();

vi.mock("../../../lib/rapid-iq/intel-process.js", () => ({
  processWatch: (...args: unknown[]) => processWatch(...args),
}));

import { handler } from "./intel-watch-worker.js";

describe("intel watch worker", () => {
  beforeEach(() => {
    processWatch.mockReset();
    processWatch.mockResolvedValue({
      watchId: "psap-fulton-county-ga",
      agency: "Fulton County",
      processed: 2,
      upserted: 2,
      urls_fetched: 2,
      intel_rows_written: 2,
      web_search_urls_discovered: 0,
      web_search_source_ids: [],
      web_search_skipped: true,
      web_search_skip_reason: "OPENAI_WEB_SEARCH_ENABLED not true",
    });
  });

  it("processes SQS intel-watch jobs", async () => {
    const event: SQSEvent = {
      Records: [
        {
          messageId: "m1",
          receiptHandle: "r1",
          body: JSON.stringify({ kind: "intel-watch", watchId: "psap-fulton-county-ga" }),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1",
            SenderId: "s",
            ApproximateFirstReceiveTimestamp: "1",
          },
          messageAttributes: {},
          md5OfBody: "",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:us-east-1:1:q",
          awsRegion: "us-east-1",
        },
      ],
    };
    const result = await handler(event);
    expect(processWatch).toHaveBeenCalledWith("psap-fulton-county-ga");
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it("accepts a direct {watchId} invoke for staging verification", async () => {
    const result = await handler({ watchId: "psap-fulton-county-ga", dryRun: true });
    expect(processWatch).toHaveBeenCalledWith("psap-fulton-county-ga");
    expect(result).toMatchObject({
      watchId: "psap-fulton-county-ga",
      urls_fetched: 2,
      web_search_urls_discovered: 0,
    });
  });
});

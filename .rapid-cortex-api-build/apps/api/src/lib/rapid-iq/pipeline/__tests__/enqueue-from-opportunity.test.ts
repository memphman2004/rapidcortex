import { describe, expect, it } from "vitest";
import { contentHash } from "../rapid-iq-pipeline-db.js";
import {
  opportunityPipelineHash,
  opportunityPipelineSourceUrl,
} from "../enqueue-from-opportunity.js";

describe("enqueue-from-opportunity helpers", () => {
  it("hashes stably per opportunity id", () => {
    const a = opportunityPipelineHash("opp-1");
    const b = opportunityPipelineHash("opp-1");
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
    expect(a).toBe(contentHash("rapid-iq-opp|opp-1", "opp-1"));
    expect(opportunityPipelineHash("opp-2")).not.toBe(a);
  });

  it("encodes opportunity id in the source URL fragment", () => {
    expect(opportunityPipelineSourceUrl("opp-9")).toContain("#opp-9");
  });
});

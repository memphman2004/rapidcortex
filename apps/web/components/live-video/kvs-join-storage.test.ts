import { describe, expect, it, vi } from "vitest";
import {
  joinStorageSessionUntilOffer,
  shouldRetryJoinStorageSession,
} from "./kvs-join-storage";

describe("JoinStorageSession retry policy", () => {
  it("retries rate limits and 500s, but not max-viewer limits", () => {
    expect(shouldRetryJoinStorageSession({ name: "ClientLimitExceededException", message: "Rate exceeded" })).toBe(true);
    expect(
      shouldRetryJoinStorageSession({
        name: "ClientLimitExceededException",
        message: "Maximum number of viewers connected to the session",
      }),
    ).toBe(false);
    expect(shouldRetryJoinStorageSession({ name: "NetworkingError" })).toBe(true);
    expect(shouldRetryJoinStorageSession({ $metadata: { httpStatusCode: 500 } })).toBe(true);
    expect(shouldRetryJoinStorageSession({ name: "ValidationException" })).toBe(false);
  });

  it("stops retrying once an SDP offer is received", async () => {
    let offers = 0;
    const sendJoin = vi.fn(async () => {
      offers += 1;
    });
    const ok = await joinStorageSessionUntilOffer({
      sendJoin,
      isOfferReceived: () => offers >= 1,
      isStopped: () => false,
      delayMs: () => 0,
      maxAttempts: 5,
    });
    expect(ok).toBe(true);
    expect(sendJoin).toHaveBeenCalledTimes(1);
  });
});

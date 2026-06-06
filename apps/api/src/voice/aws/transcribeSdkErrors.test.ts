import { describe, expect, it } from "vitest";
import { voiceErrorFromTranscribeSdk } from "./transcribeSdkErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

describe("voiceErrorFromTranscribeSdk", () => {
  it("maps throttling to STT_RATE_LIMIT", () => {
    const err = { name: "ThrottlingException", message: "slow down", $metadata: { httpStatusCode: 429 } };
    const v = voiceErrorFromTranscribeSdk(err);
    expect(v.code).toBe(VOICE_ERROR_CODES.STT_RATE_LIMIT);
    expect(v.retryable).toBe(true);
  });

  it("maps access denied to STT_AUTH_ERROR", () => {
    const err = { name: "AccessDeniedException", message: "no iam", $metadata: { httpStatusCode: 403 } };
    const v = voiceErrorFromTranscribeSdk(err);
    expect(v.code).toBe(VOICE_ERROR_CODES.STT_AUTH_ERROR);
    expect(v.retryable).toBe(false);
  });

  it("maps 5xx to STT_PROVIDER_5XX", () => {
    const err = { name: "InternalServerException", message: "boom", $metadata: { httpStatusCode: 500 } };
    const v = voiceErrorFromTranscribeSdk(err);
    expect(v.code).toBe(VOICE_ERROR_CODES.STT_PROVIDER_5XX);
    expect(v.retryable).toBe(true);
  });
});

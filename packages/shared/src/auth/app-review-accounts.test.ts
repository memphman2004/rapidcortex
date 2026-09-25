import { describe, expect, it } from "vitest";
import { isAppReviewSilentMfaEmail } from "./app-review-accounts.js";

describe("isAppReviewSilentMfaEmail", () => {
  it("matches ASC demo mailboxes case-insensitively", () => {
    expect(isAppReviewSilentMfaEmail("appreviewer@rapidcortex.us")).toBe(true);
    expect(isAppReviewSilentMfaEmail("AppReviewer@RapidCortex.us")).toBe(true);
    expect(isAppReviewSilentMfaEmail("appreviewer@rapidcortex.ai")).toBe(true);
    expect(isAppReviewSilentMfaEmail("appreviewer@nexcortiq.us")).toBe(true);
    expect(isAppReviewSilentMfaEmail("apple-review@nexcortiq.us")).toBe(true);
  });

  it("rejects normal staff accounts", () => {
    expect(isAppReviewSilentMfaEmail("campusadmin@appsondemand.net")).toBe(false);
    expect(isAppReviewSilentMfaEmail("venue-admin@appsondemand.net")).toBe(false);
    expect(isAppReviewSilentMfaEmail("")).toBe(false);
    expect(isAppReviewSilentMfaEmail(null)).toBe(false);
  });
});

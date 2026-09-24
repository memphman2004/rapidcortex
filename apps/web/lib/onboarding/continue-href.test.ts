import { describe, expect, it } from "vitest";
import { verticalOnboardingContinueHref } from "@/lib/onboarding/continue-href";

describe("verticalOnboardingContinueHref", () => {
  it("prefixes /rc-admin when already in the NexCort Admin shell", () => {
    expect(
      verticalOnboardingContinueHref(
        "/rc-admin/onboarding/campus/intake",
        "/onboarding/campus/integrations?orgCode=UGA",
      ),
    ).toBe("/rc-admin/onboarding/campus/integrations?orgCode=UGA");
  });

  it("leaves campus/venue /onboarding paths unchanged", () => {
    expect(
      verticalOnboardingContinueHref(
        "/onboarding/campus/intake",
        "/onboarding/campus/integrations?orgCode=UGA",
      ),
    ).toBe("/onboarding/campus/integrations?orgCode=UGA");
  });
});

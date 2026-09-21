import { describe, expect, it } from "vitest";
import { guestAssistLocalReply } from "./guest-assist-local-reply";
import type { GuestAssistChatBody } from "rapid-cortex-shared";

function body(
  content: string,
  extras: Partial<GuestAssistChatBody> = {},
): GuestAssistChatBody {
  return {
    system: extras.system ?? "You are a wayfinding assistant.",
    messages: [{ role: "user", content }],
    vertical: extras.vertical ?? "venue",
    name: extras.name ?? "Mercedes-Benz Stadium",
    location: extras.location ?? "Bldg23 Rm45",
  };
}

describe("guestAssistLocalReply", () => {
  it("gives step-by-step restroom directions instead of a brush-off", () => {
    const text = guestAssistLocalReply(body("Nearest restroom"));
    expect(text.toLowerCase()).toContain("restroom");
    expect(text).toContain("Bldg23 Rm45");
    expect(text).not.toMatch(/ask a nearby staff member if you need a walk-over/i);
    expect(text.split("\n\n").length).toBeGreaterThanOrEqual(2);
  });

  it("treats stabbing as 911, not a generic help line", () => {
    const text = guestAssistLocalReply(
      body("Stabbing", { system: "You are a venue security staff member. Sign messages as Staff." }),
    );
    expect(text).toMatch(/call 911/i);
    expect(text).toContain("Mercedes-Benz Stadium");
    expect(text).not.toMatch(/ask a nearby staff member if you need a walk-over/i);
  });

  it("does not append 911 to ordinary wayfinding", () => {
    const text = guestAssistLocalReply(body("Nearest restroom"));
    expect(text).not.toMatch(/call 911 if this is an emergency/i);
  });
});

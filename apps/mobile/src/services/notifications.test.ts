import { describe, expect, it } from "vitest";
import { notificationHandlerBehavior } from "./notification-handler-behavior";

describe("notificationHandlerBehavior", () => {
  it("includes iOS 18 banner/list keys so setNotificationHandler does not throw", () => {
    const behavior = notificationHandlerBehavior();
    expect(behavior.shouldShowAlert).toBe(true);
    expect(behavior.shouldShowBanner).toBe(true);
    expect(behavior.shouldShowList).toBe(true);
    expect(behavior.shouldPlaySound).toBe(true);
    expect(behavior.shouldSetBadge).toBe(true);
  });
});

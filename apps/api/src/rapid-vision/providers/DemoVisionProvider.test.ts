import { beforeEach, describe, expect, it } from "vitest";
import { DemoVisionProvider } from "./DemoVisionProvider.js";

describe("DemoVisionProvider", () => {
  const provider = new DemoVisionProvider();

  beforeEach(() => {
    delete process.env.VISION_DEMO_KVS_CHANNEL_NAME;
    delete process.env.APP_PUBLIC_BASE_URL;
  });

  it("builds consent URLs from the handler-stored consentToken", async () => {
    const token = "stored-plain-token-abc";
    const result = await provider.requestConsent({
      incidentId: "inc-1",
      agencyId: "agency-1",
      agencyDisplayName: "Test Agency",
      incidentReason: "test",
      requestedDurationMinutes: 15,
      cameraId: "demo-device-001",
      providerDeviceId: "demo-device-001",
      ownerId: "demo",
      ownerContactInfo: "",
      consentToken: token,
    });

    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.requestId).toBe(token);
    expect(result.approveUrl).toContain(`/api/public/vision/consent/${encodeURIComponent(token)}/approve`);
    expect(result.declineUrl).toContain(`/api/public/vision/consent/${encodeURIComponent(token)}/decline`);
  });

  it("returns a non-null demo KVS channel for openLiveStream", async () => {
    const result = await provider.openLiveStream({
      incidentId: "inc-1",
      agencyId: "agency-1",
      cameraId: "demo-device-002",
      providerDeviceId: "demo-device-002",
      sessionId: "sess-1",
      durationMinutes: 15,
    });

    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.kvsChannelName).toBe("rc-vision-demo-agency-1-demo-device-002");
    expect(result.kvsStreamArn).toBeNull();
  });

  it("honors VISION_DEMO_KVS_CHANNEL_NAME when set", async () => {
    process.env.VISION_DEMO_KVS_CHANNEL_NAME = "rc-vision-demo-shared";
    const result = await provider.openLiveStream({
      incidentId: "inc-1",
      agencyId: "agency-1",
      cameraId: "demo-device-002",
      providerDeviceId: "demo-device-002",
      sessionId: "sess-1",
      durationMinutes: 15,
    });

    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.kvsChannelName).toBe("rc-vision-demo-shared");
  });
});

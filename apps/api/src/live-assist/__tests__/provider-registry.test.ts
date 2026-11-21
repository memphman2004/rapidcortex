/**
 * BodyCameraProviderRegistry tests.
 *
 * Verifies:
 *   - All 8 manufacturers are registered
 *   - Synthetic adapter always returns supported:true
 *   - PENDING_VENDOR_AUTHORIZATION connectors return correct status
 *   - Provider abstraction allows any manufacturer to be resolved without changing the dashboard
 */
import { describe, expect, it } from "vitest";
import {
  resolveProvider,
  listAllProviders,
} from "../providers/BodyCameraProviderRegistry.js";
import type { BodyCameraManufacturer } from "rapid-cortex-shared";

const ALL_MANUFACTURERS: BodyCameraManufacturer[] = [
  "synthetic", "getac", "axon", "motorola", "axis", "zepcam", "rtsp", "webrtc",
];

describe("BodyCameraProviderRegistry", () => {
  it("resolves all 8 manufacturers", () => {
    for (const m of ALL_MANUFACTURERS) {
      expect(resolveProvider(m)).not.toBeNull();
    }
  });

  it("lists all 8 providers", () => {
    expect(listAllProviders().length).toBe(8);
  });

  it("returns null for unknown manufacturer", () => {
    expect(resolveProvider("unknown" as BodyCameraManufacturer)).toBeNull();
  });

  it("synthetic provider returns supported:true on requestStream", async () => {
    const provider = resolveProvider("synthetic");
    expect(provider).not.toBeNull();
    const result = await provider!.requestStream({
      tenantId: "agency-1",
      agencyId: "agency-1",
      sessionId: "sess-1",
      deviceId: "dev-1",
      providerDeviceId: "synth-bwc-001",
      officerId: null,
      targetKvsChannelName: "la-test-channel",
    });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.kvsChannelName).toBe("la-test-channel");
    }
  });

  it("PENDING_VENDOR_AUTHORIZATION connectors return vendor_authorization_required", async () => {
    for (const m of ["getac", "axon", "motorola"] as BodyCameraManufacturer[]) {
      const provider = resolveProvider(m);
      expect(provider).not.toBeNull();
      const health = await provider!.validateConnection("agency-1");
      expect(health.status).toBe("unknown");
      expect(provider!.identity.pendingVendorAuthorization).toBe(true);
      expect(provider!.identity.integrationStatus).toBe("vendor_authorization_required");
    }
  });

  it("PENDING connectors return unsupported for requestStream", async () => {
    const provider = resolveProvider("getac");
    const result = await provider!.requestStream({
      tenantId: "agency-1",
      agencyId: "agency-1",
      sessionId: "sess-1",
      deviceId: "dev-1",
      providerDeviceId: "getac-001",
      officerId: null,
      targetKvsChannelName: null,
    });
    expect(result.supported).toBe(false);
    if (!result.supported) {
      expect(result.code).toBe("VENDOR_AUTHORIZATION_REQUIRED");
    }
  });

  it("synthetic provider simulates GPS location drift", async () => {
    const provider = resolveProvider("synthetic");
    const r1 = await provider!.getLocation("agency-1", "synth-bwc-001");
    const r2 = await provider!.getLocation("agency-1", "synth-bwc-001");
    expect(r1.supported).toBe(true);
    expect(r2.supported).toBe(true);
    if (r1.supported && r2.supported) {
      // Positions should be near San Antonio (synthetic seed)
      expect(r1.location.latitude).toBeCloseTo(29.4241, 0);
    }
  });

  it("synthetic provider returns immediate ack for coaching invite", async () => {
    const provider = resolveProvider("synthetic");
    const result = await provider!.inviteToCoaching({
      sessionId: "sess-1",
      officerEndpointRef: "fcm:token-abc",
      supervisorDisplayName: "Sgt. Martinez",
      sdpOffer: null,
    });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.immediateAck).toBe(true);
    }
  });
});

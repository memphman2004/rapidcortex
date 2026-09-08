import { describe, expect, it } from "vitest";
import {
  acceptIncidentTransfer,
  buildBridgedCommentText,
  buildBridgeToken,
  buildDefaultCadBridgeConfig,
  cancelIncidentTransfer,
  detectCadBridgeConflicts,
  dropCanonicalFields,
  extractBridgeToken,
  isSecondaryCloseWhilePrimaryActive,
  isTransferTimedOut,
  mergeCanonicalIncident,
  requestIncidentTransfer,
  resolveCadBridgeConflicts,
  shouldSyncEvent,
  stripBridgeToken,
  validateCadBridgeConfig,
  type CanonicalIncident,
} from "./index.js";

function sampleIncident(overrides: Partial<CanonicalIncident> = {}): CanonicalIncident {
  return {
    rcIncidentId: "rc-1",
    agencyId: "kcpd",
    owner: "CAD_A",
    cadA: { incidentId: "A-1", vendor: "MOTOROLA", lastSyncedAt: "2026-09-08T12:00:00.000Z", lastVersion: "1" },
    cadB: { incidentId: "B-1", vendor: "TYLER", lastSyncedAt: "2026-09-08T12:00:00.000Z", lastVersion: "1" },
    type: "TRAFFIC STOP",
    priority: 3,
    status: "ACTIVE",
    location: { address: "1 Main", city: "Kansas City", state: "MO" },
    caller: {},
    narrative: "stop",
    units: [{ unitId: "E1", cadSlot: "CAD_A", callSign: "E1", status: "DISPATCHED" }],
    comments: [],
    syncState: "IN_SYNC",
    pendingConflicts: [],
    createdAt: "2026-09-08T12:00:00.000Z",
    updatedAt: "2026-09-08T12:00:00.000Z",
    ...overrides,
  };
}

describe("CAD bridge config", () => {
  it("scaffolds disabled with location and transfer sync off", () => {
    const cfg = buildDefaultCadBridgeConfig("kcpd", "br-1");
    expect(cfg.enabled).toBe(false);
    expect(cfg.syncRules.syncLocationUpdates).toBe(false);
    expect(cfg.syncRules.syncTransfers).toBe(false);
    expect(cfg.conflictResolution).toBe("PRIMARY_WINS");
  });

  it("rejects enabling without cad-bridge secret ARNs", () => {
    const cfg = buildDefaultCadBridgeConfig("kcpd", "br-1");
    cfg.enabled = true;
    cfg.cadA.baseUrl = "https://cad-a.example";
    cfg.cadB.baseUrl = "https://cad-b.example";
    expect(() => validateCadBridgeConfig(cfg)).toThrow(/apiKeySecretArn/);
  });

  it("accepts rapid-cortex/cad-bridge and rc-cad-bridge secret ARNs", () => {
    const cfg = buildDefaultCadBridgeConfig("kcpd", "br-1");
    cfg.enabled = true;
    cfg.cadA.baseUrl = "https://cad-a.example";
    cfg.cadB.baseUrl = "https://cad-b.example";
    cfg.cadA.apiKeySecretArn = "arn:aws:secretsmanager:us-east-1:1:secret:rapid-cortex/cad-bridge/kcpd/cad-a-api-key";
    cfg.cadA.webhookSigningSecretArn =
      "arn:aws:secretsmanager:us-east-1:1:secret:rc-cad-bridge/kcpd/cad-a-signing";
    cfg.cadB.apiKeySecretArn = "arn:aws:secretsmanager:us-east-1:1:secret:rc-cad-bridge/kcpd/cad-b-api-key";
    cfg.cadB.webhookSigningSecretArn =
      "arn:aws:secretsmanager:us-east-1:1:secret:rapid-cortex/cad-bridge/kcpd/cad-b-signing";
    expect(() => validateCadBridgeConfig(cfg)).not.toThrow();
  });

  it("allows a disabled draft without endpoints or secret ARNs", () => {
    expect(() => validateCadBridgeConfig(buildDefaultCadBridgeConfig("kcpd", "br-1"))).not.toThrow();
  });

  it("maps sync rules per event type", () => {
    const rules = buildDefaultCadBridgeConfig("kcpd", "br-1").syncRules;
    expect(shouldSyncEvent("INCIDENT_CREATED", rules)).toBe(true);
    expect(shouldSyncEvent("LOCATION_UPDATED", rules)).toBe(false);
    expect(shouldSyncEvent("TRANSFER_REQUESTED", rules)).toBe(false);
  });
});

describe("CAD bridge loop tokens", () => {
  it("embeds and strips RC bridge tokens without dropping comment text", () => {
    const token = buildBridgeToken("11111111-2222-3333-4444-555555555555");
    const text = buildBridgedCommentText("Caller on scene", token);
    expect(extractBridgeToken(text)).toBe("11111111-2222-3333-4444-555555555555");
    expect(stripBridgeToken(text)).toBe("Caller on scene");
  });
});

describe("CAD bridge conflicts", () => {
  const now = "2026-09-08T12:01:00.000Z";
  const config = buildDefaultCadBridgeConfig("kcpd", "br-1");

  it("does not flag owner CAD updates as conflicts", () => {
    const conflicts = detectCadBridgeConflicts(
      {
        existing: sampleIncident(),
        incoming: { priority: 1 },
        sourceSlot: "CAD_A",
        nowIso: now,
        makeConflictId: () => "c1",
      },
      config,
    );
    expect(conflicts).toHaveLength(0);
  });

  it("flags non-owner priority changes and PRIMARY_WINS drops the incoming field", () => {
    const conflicts = detectCadBridgeConflicts(
      {
        existing: sampleIncident(),
        incoming: { priority: 1 },
        sourceSlot: "CAD_B",
        nowIso: now,
        makeConflictId: () => "c1",
      },
      config,
    );
    expect(conflicts).toHaveLength(1);
    const resolved = resolveCadBridgeConflicts(conflicts, config, now);
    expect(resolved.unresolved).toHaveLength(0);
    expect(resolved.dropFields).toContain("priority");
    const merged = mergeCanonicalIncident(
      sampleIncident(),
      dropCanonicalFields({ priority: 1 }, resolved.dropFields),
      "CAD_B",
      now,
    );
    expect(merged.priority).toBe(3);
  });

  it("always queues secondary location updates for supervisor review", () => {
    const conflicts = detectCadBridgeConflicts(
      {
        existing: sampleIncident(),
        incoming: { location: { address: "2 Oak", city: "Kansas City", state: "MO" } },
        sourceSlot: "CAD_B",
        nowIso: now,
        makeConflictId: () => "loc1",
      },
      { ...config, conflictResolution: "LAST_WRITE_WINS" },
    );
    expect(conflicts[0]?.field).toBe("location");
    const resolved = resolveCadBridgeConflicts(conflicts, { ...config, conflictResolution: "LAST_WRITE_WINS" }, now);
    expect(resolved.unresolved).toHaveLength(1);
  });

  it("appends comments and keeps units per CAD slot", () => {
    const merged = mergeCanonicalIncident(
      sampleIncident({
        comments: [
          {
            commentId: "n1",
            cadSlot: "CAD_A",
            sourceIncidentId: "A-1",
            text: "first",
            authorId: "d1",
            authorName: "Disp",
            timestamp: now,
            isBridged: false,
          },
        ],
      }),
      {
        comments: [
          {
            commentId: "n2",
            cadSlot: "CAD_B",
            sourceIncidentId: "B-1",
            text: "second",
            authorId: "d2",
            authorName: "Disp B",
            timestamp: now,
            isBridged: false,
          },
        ],
        units: [{ unitId: "M2", cadSlot: "CAD_B", callSign: "M2", status: "ENROUTE" }],
      },
      "CAD_B",
      now,
    );
    expect(merged.comments.map((c) => c.commentId)).toEqual(["n1", "n2"]);
    expect(merged.units.map((u) => u.unitId).sort()).toEqual(["E1", "M2"]);
  });

  it("flags secondary close while the owner incident is still active", () => {
    expect(isSecondaryCloseWhilePrimaryActive("INCIDENT_CLOSED", "CAD_B", sampleIncident())).toBe(true);
    expect(isSecondaryCloseWhilePrimaryActive("INCIDENT_CLOSED", "CAD_A", sampleIncident())).toBe(false);
  });
});

describe("CAD bridge transfer", () => {
  const now = "2026-09-08T12:00:00.000Z";

  it("requests, accepts, and moves ownership", () => {
    const requested = requestIncidentTransfer({
      incident: sampleIncident(),
      requestedBy: "user-1",
      toSlot: "CAD_B",
      nowIso: now,
      timeoutSeconds: 300,
    });
    expect(requested.transferState?.status).toBe("REQUESTED");
    const accepted = acceptIncidentTransfer({
      incident: requested,
      acceptedBy: "user-2",
      nowIso: "2026-09-08T12:01:00.000Z",
    });
    expect(accepted.owner).toBe("CAD_B");
    expect(accepted.transferState?.status).toBe("ACCEPTED");
  });

  it("auto-cancels after timeout", () => {
    const requested = requestIncidentTransfer({
      incident: sampleIncident(),
      requestedBy: "user-1",
      toSlot: "CAD_B",
      nowIso: now,
      timeoutSeconds: 60,
    });
    expect(isTransferTimedOut(requested, "2026-09-08T12:02:00.000Z")).toBe(true);
    const cancelled = cancelIncidentTransfer({
      incident: requested,
      nowIso: "2026-09-08T12:02:00.000Z",
      timedOut: true,
    });
    expect(cancelled.owner).toBe("CAD_A");
    expect(cancelled.transferState?.status).toBe("TIMED_OUT");
  });
});

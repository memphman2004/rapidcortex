import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_TRANSCRIPT_CHUNKS } from "@/lib/demo-scenarios";
import { MAPLEWOOD_DISPATCHERS } from "@/src/demo/fixtures/dispatchers";
import { MAPLEWOOD_UNITS } from "@/src/demo/fixtures/units";
import {
  activateDemoSession,
  deactivateDemoSession,
  demoFetchDecision,
  isDemoFetchFenceInstalled,
  isDemoModeActive,
  resetDemoModeGateForTests,
  setDemoModeOverrideForTests,
} from "@/src/demo/engine/demo-mode-gate";
import {
  applyDemoApiInterceptor,
  resolveDemoHttp,
  type DemoHttpClient,
} from "@/src/demo/engine/DemoApiInterceptor";
import {
  getDemoPlaybackEngine,
  peekDemoPlaybackEngine,
  resetDemoPlaybackEngineForTests,
} from "@/src/demo/engine/DemoPlaybackEngine";
import { createDemoWebSocketMock } from "@/src/demo/engine/DemoWebSocketMock";
import { findStateViolations } from "@/src/demo/engine/invariants";
import { buildAllScenarios } from "@/src/demo/scenarios/manifests";
import { getScenario, resetScenarioRegistry } from "@/src/demo/scenarios/registry";
import { createDemoTokenClaims, signDemoToken, verifyDemoToken } from "@/src/demo/tokens/demo-token";
import { demoShareTokenFromPath, isNeutralDemoPath } from "@/src/demo/tokens/demo-link-paths";
import { getDemoTokenStore, resetDemoTokenStoreForTests } from "@/src/demo/tokens/token-store";
import { DEMO_AGENCY_ID, DEMO_MODE_BANNER_TEXT } from "@/src/demo/types";

const SECRET = "test-demo-signing-secret";
const FORBIDDEN = [
  "158961537080",
  "621957412915",
  "13198358230",
  "Jwcoleman",
  "rapidcortex.us",
  "Tyler",
  "Mark43",
  "Hexagon",
  "CentralSquare",
  "Motorola",
];

const root = new URL("../../", import.meta.url);

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, root), "utf8");
}

function resetAll() {
  vi.useRealTimers();
  deactivateDemoSession();
  resetDemoModeGateForTests();
  resetDemoPlaybackEngineForTests();
  resetDemoTokenStoreForTests();
  resetScenarioRegistry();
  delete process.env.DEMO_MODE;
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
  delete process.env.DEMO_TOKEN_REVOKED_IDS;
}

beforeEach(resetAll);
afterEach(resetAll);

describe("Test A — Demo mode activation", () => {
  it("turns on from the environment flag and does not open a production socket or API", async () => {
    process.env.DEMO_MODE = "true";
    expect(isDemoModeActive()).toBe(true);

    const WebSocketSpy = vi.fn();
    vi.stubGlobal("WebSocket", WebSocketSpy);
    activateDemoSession({ source: "env" });
    const socket = createDemoWebSocketMock();
    socket.connect();
    expect(WebSocketSpy).not.toHaveBeenCalled();

    const network = vi.fn(async (_path: string) => "live-911");
    const client: DemoHttpClient = { request: network };
    applyDemoApiInterceptor(client);
    const body = (await client.request("/api/incidents")) as { agencyId: string };
    expect(network).not.toHaveBeenCalled();
    expect(body.agencyId).toBe(DEMO_AGENCY_ID);

    const agencyHook = source("hooks/use-agency-websocket.ts");
    const callHook = source("hooks/use-call-control-websocket.ts");
    expect(agencyHook.indexOf("isDemoModeActive()")).toBeLessThan(agencyHook.indexOf("new WebSocket"));
    expect(callHook.indexOf("isDemoModeActive()")).toBeLessThan(callHook.indexOf("new WebSocket"));
    expect(source("lib/api.ts")).toContain("DEMO MODE integration point A");
  });
});

describe("Test B — Demo mode inactivity", () => {
  it("does not create demo state or arm the fetch fence", () => {
    setDemoModeOverrideForTests(false);
    expect(isDemoModeActive()).toBe(false);
    expect(peekDemoPlaybackEngine()).toBeNull();
    expect(isDemoFetchFenceInstalled()).toBe(false);
    const rootSource = source("src/demo/ui/DemoModeRoot.tsx");
    expect(rootSource).toContain("if (!mounted || !active) return children");
  });
});

describe("Test C — Scenario loading", () => {
  it("loads every Maplewood scenario with only fictional entities", async () => {
    activateDemoSession({ source: "presenter" });
    const blob = JSON.stringify(buildAllScenarios());
    for (const needle of FORBIDDEN) expect(blob).not.toContain(needle);

    for (const scenario of buildAllScenarios()) {
      await getDemoPlaybackEngine().load(scenario.id);
      const state = getDemoPlaybackEngine().getState();
      expect(state?.agency.name).toBe("Maplewood County Communications Center");
      expect(state?.agency.id).toBe(DEMO_AGENCY_ID);
      expect(state?.units.map((unit) => unit.id).sort()).toEqual(MAPLEWOOD_UNITS.map((unit) => unit.id).sort());
      expect(state?.dispatchers.map((person) => person.name).sort()).toEqual(
        MAPLEWOOD_DISPATCHERS.map((person) => person.name).sort(),
      );
      expect((state?.locations.length ?? 0) >= 10).toBe(true);
      expect(findStateViolations(state!)).toEqual([]);
    }
  });
});

describe("Test D — Playback engine event sequence", () => {
  it("plays Standard Operations in order without illegal unit transitions", async () => {
    vi.useFakeTimers();
    activateDemoSession({ source: "presenter" });
    const engine = getDemoPlaybackEngine();
    await engine.load("demo-standard");
    engine.seek(20);
    expect(engine.getState()?.units.find((unit) => unit.id === "MED-2")?.status).toBe("available");
    engine.seek(40);
    expect(engine.getState()?.units.find((unit) => unit.id === "MED-2")?.status).toBe("dispatched");
    engine.seek(170);
    expect(engine.getState()?.units.find((unit) => unit.id === "MED-2")?.status).toBe("on_scene");

    engine.reset();
    engine.start();
    await vi.advanceTimersByTimeAsync(400_000);
    expect(engine.getLog().map((entry) => entry.eventId)).toEqual(
      getScenario("demo-standard")?.events.map((event) => event.id),
    );
    expect(engine.getStatus()).toBe("completed");
    expect(engine.getViolations()).toEqual([]);
    expect(engine.getState()?.callQueue.filter((call) => call.discipline === "admin").length).toBeGreaterThanOrEqual(2);
  });

  it("plays the night, MCI, and overnight scenarios through the last event", async () => {
    vi.useFakeTimers();
    activateDemoSession({ source: "presenter" });
    for (const scenarioId of ["demo-high-volume", "demo-mci", "demo-overnight"] as const) {
      const engine = getDemoPlaybackEngine();
      await engine.load(scenarioId);
      engine.start();
      await vi.advanceTimersByTimeAsync(500_000);
      expect(engine.getStatus()).toBe("completed");
      expect(engine.getViolations()).toEqual([]);
      expect(engine.getLog().map((entry) => entry.eventId)).toEqual(
        getScenario(scenarioId)?.events.map((event) => event.id),
      );
    }
  });
});

describe("Test E — Pause and resume", () => {
  it("freezes the clock and continues from the same offset", async () => {
    vi.useFakeTimers();
    activateDemoSession({ source: "presenter" });
    const engine = getDemoPlaybackEngine();
    await engine.load("demo-standard");
    engine.start();
    await vi.advanceTimersByTimeAsync(12_000);
    const count = engine.getLog().length;
    expect(count).toBeGreaterThan(0);
    engine.pause();
    expect(engine.getStatus()).toBe("paused");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(engine.getLog().length).toBe(count);
    engine.resume();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(engine.getLog().length).toBeGreaterThan(count);
  });
});

describe("Test F — Reset", () => {
  it("returns the board and the clock to the opening state", async () => {
    vi.useFakeTimers();
    activateDemoSession({ source: "presenter" });
    const engine = getDemoPlaybackEngine();
    await engine.load("demo-standard");
    const opening = structuredClone(engine.getState());
    engine.start();
    await vi.advanceTimersByTimeAsync(40_000);
    expect(engine.getLog().length).toBeGreaterThan(0);
    engine.reset();
    expect(engine.getStatus()).toBe("idle");
    expect(engine.getCurrentOffset()).toBe(0);
    expect(engine.getLog()).toEqual([]);
    expect(engine.getState()).toEqual(opening);
  });
});

describe("Test G — Speed", () => {
  it("compresses event gaps at 2× and 4×", async () => {
    vi.useFakeTimers();
    activateDemoSession({ source: "presenter" });
    const engine = getDemoPlaybackEngine();
    await engine.load("demo-standard");
    engine.setSpeed(2);
    engine.start();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(engine.getLog()).toEqual([]);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(engine.getLog().some((entry) => entry.eventId === "std-01")).toBe(true);
    expect(engine.getLog().some((entry) => entry.eventId === "std-05")).toBe(false);
    const before = engine.getLog().length;
    engine.setSpeed(4);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(engine.getLog().length).toBeGreaterThan(before);
    expect(engine.getViolations()).toEqual([]);
  });
});

describe("Test H — WebSocket mock", () => {
  it("emits the production envelope without constructing WebSocket", async () => {
    vi.useFakeTimers();
    const WebSocketSpy = vi.fn();
    vi.stubGlobal("WebSocket", WebSocketSpy);
    activateDemoSession({ source: "presenter" });
    const received: Array<{ type: string; data: Record<string, unknown> }> = [];
    const socket = createDemoWebSocketMock();
    socket.onmessage = (event) => {
      received.push(JSON.parse(String(event.data)) as { type: string; data: Record<string, unknown> });
    };
    socket.connect();
    const engine = getDemoPlaybackEngine();
    await engine.load("demo-standard");
    engine.start();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(WebSocketSpy).not.toHaveBeenCalled();
    expect(received[0]?.type).toBe("demo.snapshot");
    const fired = received.find((message) => message.type === "demo.event");
    expect(fired?.data.agencyId).toBe(DEMO_AGENCY_ID);
    expect(typeof fired?.data.eventType).toBe("string");
    expect(fired?.data.payload).toBeTypeOf("object");
  });
});

describe("Test I — API interceptor", () => {
  it("returns Maplewood data and does not call the network", async () => {
    const network = vi.fn(async (_path: string) => {
      throw new Error("production path");
    });
    activateDemoSession({ source: "presenter" });
    await getDemoPlaybackEngine().load("demo-standard");
    const client: DemoHttpClient = { request: network };
    applyDemoApiInterceptor(client);
    const body = (await client.request("/api/incidents")) as { agencyId: string; demo: boolean };
    expect(body.agencyId).toBe(DEMO_AGENCY_ID);
    expect(body.demo).toBe(true);
    expect(network).not.toHaveBeenCalled();
    expect(resolveDemoHttp("/api/anything")).toMatchObject({ demo: true, agencyId: DEMO_AGENCY_ID });
  });
});

describe("Test J — Guided highlight auto trigger", () => {
  it("shows the cardiac Call Assist highlight when that event is reached", async () => {
    activateDemoSession({ source: "presenter" });
    const engine = getDemoPlaybackEngine();
    await engine.load("demo-standard");
    engine.seek(20);
    expect(engine.getActiveHighlight()).toBeNull();
    engine.seek(24);
    expect(engine.getActiveHighlight()?.id).toBe("hl-cardiac-assist");
    expect(engine.getActiveHighlight()?.targetSelector).toContain("call-assist");
  });
});

describe("Test K — Guided highlight manual advance", () => {
  it("waits for the presenter and keeps playback still", async () => {
    activateDemoSession({ source: "presenter" });
    const engine = getDemoPlaybackEngine();
    await engine.load("demo-guided-tour");
    expect(engine.getActiveHighlight()).toBeNull();
    engine.advanceHighlight();
    expect(engine.getActiveHighlight()?.id).toBe("tour-dispatcher");
    engine.advanceHighlight();
    expect(engine.getActiveHighlight()?.id).toBe("tour-incoming");
    expect(engine.getCurrentOffset()).toBe(0);
    expect(engine.getStatus()).toBe("idle");
    engine.jumpToHighlight("tour-admin");
    expect(engine.getActiveHighlight()?.title).toMatch(/Administrative/);
  });
});

describe("Test L — Demo indicator banner", () => {
  it("is the required sentence and is mounted above every route", () => {
    expect(DEMO_MODE_BANNER_TEXT).toBe(
      "DEMO MODE — Fictional Data Only — Not Connected to Live 911 Operations",
    );
    const banner = source("src/demo/ui/DemoIndicatorBanner.tsx");
    expect(banner).toContain("DEMO_MODE_BANNER_TEXT");
    expect(banner).toContain('data-demo-banner="true"');
    expect(banner).not.toContain("<button");
    const providers = source("app/providers.tsx");
    expect(providers.indexOf("<DemoModeRoot>")).toBeLessThan(providers.indexOf("{children}"));
  });
});

describe("Test M — Token generation", () => {
  it("signs the scenario, issuer, and expiry", async () => {
    const claims = createDemoTokenClaims({
      scenarioId: "demo-standard",
      issuer: "sales-desk",
      now: 1_700_000_000,
      jti: "jti-fixed",
      expiresInSeconds: 60,
    });
    const token = await signDemoToken(claims, SECRET);
    const [encoded, signature] = token.split(".");
    expect(signature).toBe(createHmac("sha256", SECRET).update(encoded!).digest("base64url"));
    const verdict = await verifyDemoToken(token, SECRET, { now: 1_700_000_000 });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.claims.scenarioId).toBe("demo-standard");
      expect(verdict.claims.iss).toBe("sales-desk");
      expect(verdict.claims.exp).toBe(1_700_000_060);
    }
  });
});

describe("Test N — Token validation valid", () => {
  it("accepts a current token for the named scenario", async () => {
    const claims = createDemoTokenClaims({ scenarioId: "demo-mci", issuer: "sales-desk", jti: "ok-1" });
    const token = await signDemoToken(claims, SECRET);
    const verdict = await verifyDemoToken(token, SECRET);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.claims.scenarioId).toBe("demo-mci");
  });
});

describe("Test O — Token validation expired", () => {
  it("rejects an expired token before any scenario can render", async () => {
    const claims = createDemoTokenClaims({
      scenarioId: "demo-standard",
      issuer: "sales-desk",
      now: 1_000,
      expiresInSeconds: 10,
      jti: "old-1",
    });
    const token = await signDemoToken(claims, SECRET);
    expect(await verifyDemoToken(token, SECRET, { now: 2_000 })).toEqual({ ok: false, reason: "expired" });
    const page = source("src/demo/ui/DemoNeutralPages.tsx");
    expect(page).toContain("This demo link has expired");
    expect(page).not.toContain("DemoWorkspace");
  });
});

describe("Test P — Token validation revoked", () => {
  it("rejects a token after its id is revoked", async () => {
    const claims = createDemoTokenClaims({ scenarioId: "demo-overnight", issuer: "sales-desk", jti: "rev-1" });
    const token = await signDemoToken(claims, SECRET);
    const store = getDemoTokenStore();
    store.remember({ jti: claims.jti, iss: claims.iss, scenarioId: claims.scenarioId, exp: claims.exp, createdAt: 1 });
    store.revoke(claims.jti);
    const verdict = await verifyDemoToken(token, SECRET, { isRevoked: (item) => store.isRevoked(item) });
    expect(verdict).toEqual({ ok: false, reason: "revoked" });
    store.revokeIssuer("sales-desk");
    expect(store.isRevoked(claims)).toBe(true);
  });
});

describe("Test Q — Token validation tampered", () => {
  it("rejects a payload that no longer matches the signature", async () => {
    const claims = createDemoTokenClaims({ scenarioId: "demo-standard", issuer: "sales-desk", jti: "tamper-1" });
    const token = await signDemoToken(claims, SECRET);
    const [, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ ...claims, scenarioId: "demo-mci" })).toString("base64url")}.${signature}`;
    expect(await verifyDemoToken(forged, SECRET)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("Test R — Data isolation", () => {
  it("cannot return production records from the demo resolver", async () => {
    activateDemoSession({ source: "link" });
    await getDemoPlaybackEngine().load("demo-high-volume");
    const body = JSON.stringify(resolveDemoHttp("/api/incidents"));
    expect(body).toContain(DEMO_AGENCY_ID);
    for (const needle of FORBIDDEN) expect(body).not.toContain(needle);
    expect(demoFetchDecision("https://api.example.com/api/incidents", "http://localhost:3000")).toBe("demo");
    expect(demoFetchDecision("http://localhost:3000/api/auth/session", "http://localhost:3000")).toBe("allow");
    expect(demoFetchDecision("http://localhost:3000/api/backend/api/incidents", "http://localhost:3000")).toBe("demo");
    expect(source("src/demo/engine/DemoApiInterceptor.ts")).not.toMatch(/DynamoDB|DocumentClient|QueryCommand/);
  });
});

describe("Test S — Shareable link requires no account", () => {
  it("decodes a prospect token with no user record", async () => {
    expect(demoShareTokenFromPath("/demo-link/s/abc.def")).toBe("abc.def");
    expect(isNeutralDemoPath("/demo-link/s/abc.def")).toBe(false);
    const claims = createDemoTokenClaims({ scenarioId: "demo-guided-tour", issuer: "sales-desk" });
    expect(claims).not.toHaveProperty("userId");
    expect(claims).not.toHaveProperty("agencyId");
    const verdict = await verifyDemoToken(await signDemoToken(claims, SECRET), SECRET);
    expect(verdict.ok).toBe(true);
    const middleware = source("middleware.ts");
    expect(middleware).toContain("demoShareTokenFromPath");
    expect(source("lib/reserved-public-route-segments.ts")).toContain('"demo-link"');
  });
});

describe("Test T — Production regression guard", () => {
  it("leaves the production client in place while Demo Mode is off", async () => {
    expect(isDemoModeActive()).toBe(false);
    const original = vi.fn(async (_path: string) => "production-response");
    const client: DemoHttpClient = { request: original };
    applyDemoApiInterceptor(client);
    await expect(client.request("/api/incidents")).resolves.toBe("production-response");
    expect(original).toHaveBeenCalledTimes(1);
    expect(DEMO_TRANSCRIPT_CHUNKS["noise-complaint"]?.length).toBeGreaterThan(0);
    expect(peekDemoPlaybackEngine()).toBeNull();
  });
});

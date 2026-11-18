import type { DemoSessionMeta } from "../types";

export const DEMO_STORAGE_PREFIX = "rc-demo-engine:";
const ACTIVE_KEY = `${DEMO_STORAGE_PREFIX}active`;
const META_KEY = `${DEMO_STORAGE_PREFIX}meta`;

let memorySession = false;
let testOverride: boolean | null = null;
const modeListeners = new Set<() => void>();

export function subscribeDemoMode(listener: () => void): () => void {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

function notifyDemoMode(): void {
  modeListeners.forEach((listener) => listener());
}

function readEnvFlag(): boolean {
  const raw = (process.env.DEMO_MODE ?? process.env.NEXT_PUBLIC_DEMO_MODE ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export function isDemoInstance(): boolean {
  return readEnvFlag();
}

/** True only for an explicit demo session. Production stays on the real data path. */
export function isDemoModeActive(): boolean {
  if (testOverride !== null) return testOverride;
  if (readEnvFlag()) return true;
  if (typeof window !== "undefined") {
    try {
      if (window.sessionStorage.getItem(ACTIVE_KEY) === "1") return true;
    } catch {
      /* fall through to the in-memory flag */
    }
  }
  return memorySession;
}

export function activateDemoSession(meta: DemoSessionMeta): void {
  memorySession = true;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(ACTIVE_KEY, "1");
      window.sessionStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* session storage can be blocked; the in-memory flag still covers this tab */
    }
    installDemoFetchFence();
  }
  notifyDemoMode();
}

export function readDemoSessionMeta(): DemoSessionMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as DemoSessionMeta) : null;
  } catch {
    return null;
  }
}

export function deactivateDemoSession(): void {
  memorySession = false;
  removeDemoFetchFence();
  if (typeof window !== "undefined") {
    try {
      const keys: string[] = [];
      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        if (key?.startsWith(DEMO_STORAGE_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => window.sessionStorage.removeItem(key));
    } catch {
      /* ignore */
    }
  }
  notifyDemoMode();
}

export function setDemoModeOverrideForTests(value: boolean | null): void {
  testOverride = value;
}

export function resetDemoModeGateForTests(): void {
  testOverride = null;
  memorySession = false;
  removeDemoFetchFence();
}

let originalFetch: typeof fetch | null = null;

export function demoFetchDecision(url: string, origin: string): "allow" | "demo" {
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin) return "demo";
    const path = parsed.pathname;
    if (path.startsWith("/_next/")) return "allow";
    if (path.startsWith("/api/auth/")) return "allow";
    if (path.startsWith("/api/demo/")) return "allow";
    if (!path.startsWith("/api/")) return "allow";
    return "demo";
  } catch {
    return "demo";
  }
}

export function installDemoFetchFence(): void {
  if (typeof window === "undefined" || originalFetch) return;
  const native = window.fetch.bind(window);
  originalFetch = native;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const origin = window.location.origin;
    if (!isDemoModeActive() || demoFetchDecision(url, origin) === "allow") {
      return native(input, init);
    }
    const { resolveDemoHttp } = await import("./DemoApiInterceptor");
    const path = new URL(url, origin).pathname;
    const body = resolveDemoHttp(path, init);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Demo-Mode": "1",
      },
    });
  };
}

export function removeDemoFetchFence(): void {
  if (typeof window === "undefined" || !originalFetch) return;
  window.fetch = originalFetch;
  originalFetch = null;
}

export function isDemoFetchFenceInstalled(): boolean {
  return originalFetch !== null;
}

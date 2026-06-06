import { afterEach, describe, expect, it } from "vitest";
import { enforceTrustedOrigin } from "./origin-protection";

function setNodeEnv(value: string) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

describe("enforceTrustedOrigin", () => {
  afterEach(() => {
    delete process.env.APP_ALLOWED_ORIGINS;
    setNodeEnv("test");
  });

  it("allows safe methods without origin validation", () => {
    process.env.APP_ALLOWED_ORIGINS = "";
    const req = new Request("https://rapidcortex.us/api/auth/session", { method: "GET" });
    expect(enforceTrustedOrigin(req)).toBeNull();
  });

  it("rejects write requests with missing origin when not configured", async () => {
    setNodeEnv("production");
    process.env.APP_ALLOWED_ORIGINS = "";
    const req = new Request("https://rapidcortex.us/api/auth/signin", { method: "POST" });
    const res = enforceTrustedOrigin(req);
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: "Origin validation is not configured." });
  });

  it("accepts configured trusted origin", () => {
    process.env.APP_ALLOWED_ORIGINS = "https://rapidcortex.us,https://www.rapidcortex.us";
    const req = new Request("https://rapidcortex.us/api/auth/signin", {
      method: "POST",
      headers: { origin: "https://www.rapidcortex.us" },
    });
    expect(enforceTrustedOrigin(req)).toBeNull();
  });
});

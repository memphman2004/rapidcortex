import { generateKeyPair, exportPKCS8, exportSPKI, SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeWriteRequest } from "./authorize-write.js";
import type { McpWatchConfig } from "../config.js";
import { clearJwtSigningKeyCache } from "../secrets/jwt-signing-keys.js";

const { GetSecretValueCommand } = vi.hoisted(() => ({
  GetSecretValueCommand: vi.fn(function (this: unknown, input: unknown) {
    return input;
  }),
}));

vi.mock("@aws-sdk/client-secrets-manager", () => {
  return {
    SecretsManagerClient: class {
      send = async () => ({ SecretString: mockSecretJson });
    },
    GetSecretValueCommand,
  };
});

let mockSecretJson = "";

async function buildConfigAndSecret(): Promise<{
  config: McpWatchConfig;
  privatePem: string;
  publicPem: string;
}> {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);
  mockSecretJson = JSON.stringify({
    activeKid: "test-1",
    keys: [{ kid: "test-1", privateKeyPem: privatePem, publicKeyPem: publicPem }],
  });
  const config: McpWatchConfig = {
    deploymentStage: "dev",
    publicBaseUrl: "https://mcp.nexcortiq.us",
    watchIngestBaseUrl: "https://api.example",
    watchIngestApiKeySecretArn: "arn:secret:watch",
    mcpJwtSigningSecretArn: "arn:secret:jwt",
    oauthStateTableName: "oauth-table",
    cognitoUserPoolId: "us-east-1_x",
    cognitoDomain: "https://auth.example",
    cognitoClientId: "client",
    cognitoRegion: "us-east-1",
    mcpAudience: "nexcort-mcp-watch",
    mcpIssuer: "https://mcp.nexcortiq.us",
    allowedHosts: "mcp.nexcortiq.us",
    rateLimitPerHour: 120,
    upstreamMaxAttempts: 3,
  };
  return { config, privatePem, publicPem };
}

describe("authorizeWriteRequest", () => {
  beforeEach(() => {
    clearJwtSigningKeyCache();
    mockSecretJson = "";
  });

  it("rejects missing bearer", async () => {
    const { config } = await buildConfigAndSecret();
    const r = await authorizeWriteRequest(undefined, config);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("accepts valid token with scope and role", async () => {
    const { config } = await buildConfigAndSecret();
    const { privateKey } = await generateKeyPair("RS256");
    // Re-import from secret we just set — mint with matching key from secret
    const { importPKCS8 } = await import("jose");
    const secret = JSON.parse(mockSecretJson) as {
      keys: Array<{ privateKeyPem: string }>;
    };
    const signingKey = await importPKCS8(secret.keys[0]!.privateKeyPem, "RS256");
    const token = await new SignJWT({ role: "rcsuperadmin", scope: "watch:write" })
      .setProtectedHeader({ alg: "RS256", kid: "test-1" })
      .setSubject("user-1")
      .setIssuer(config.mcpIssuer)
      .setAudience(config.mcpAudience)
      .setExpirationTime("1h")
      .sign(signingKey);

    const r = await authorizeWriteRequest(`Bearer ${token}`, config);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.principal.role).toBe("rcsuperadmin");
      expect(r.principal.subject).toBe("user-1");
    }
    void privateKey;
  });

  it("rejects wrong audience", async () => {
    const { config } = await buildConfigAndSecret();
    const { importPKCS8 } = await import("jose");
    const secret = JSON.parse(mockSecretJson) as {
      keys: Array<{ privateKeyPem: string }>;
    };
    const signingKey = await importPKCS8(secret.keys[0]!.privateKeyPem, "RS256");
    const token = await new SignJWT({ role: "rcsuperadmin", scope: "watch:write" })
      .setProtectedHeader({ alg: "RS256", kid: "test-1" })
      .setSubject("user-1")
      .setIssuer(config.mcpIssuer)
      .setAudience("wrong-aud")
      .setExpirationTime("1h")
      .sign(signingKey);

    const r = await authorizeWriteRequest(`Bearer ${token}`, config);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejects missing watch:write scope", async () => {
    const { config } = await buildConfigAndSecret();
    const { importPKCS8 } = await import("jose");
    const secret = JSON.parse(mockSecretJson) as {
      keys: Array<{ privateKeyPem: string }>;
    };
    const signingKey = await importPKCS8(secret.keys[0]!.privateKeyPem, "RS256");
    const token = await new SignJWT({ role: "rcsuperadmin", scope: "openid" })
      .setProtectedHeader({ alg: "RS256", kid: "test-1" })
      .setSubject("user-1")
      .setIssuer(config.mcpIssuer)
      .setAudience(config.mcpAudience)
      .setExpirationTime("1h")
      .sign(signingKey);

    const r = await authorizeWriteRequest(`Bearer ${token}`, config);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.reason).toBe("missing_watch_write_scope");
    }
  });

  it("rejects disallowed role", async () => {
    const { config } = await buildConfigAndSecret();
    const { importPKCS8 } = await import("jose");
    const secret = JSON.parse(mockSecretJson) as {
      keys: Array<{ privateKeyPem: string }>;
    };
    const signingKey = await importPKCS8(secret.keys[0]!.privateKeyPem, "RS256");
    const token = await new SignJWT({ role: "dispatcher", scope: "watch:write" })
      .setProtectedHeader({ alg: "RS256", kid: "test-1" })
      .setSubject("user-1")
      .setIssuer(config.mcpIssuer)
      .setAudience(config.mcpAudience)
      .setExpirationTime("1h")
      .sign(signingKey);

    const r = await authorizeWriteRequest(`Bearer ${token}`, config);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.reason).toBe("role_not_permitted");
    }
  });
});

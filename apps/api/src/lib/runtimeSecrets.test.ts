import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn(() => ({ send: sendMock })),
  GetSecretValueCommand: vi.fn((input) => ({ input })),
}));

let resolvePlainOrSecretArn: typeof import("./runtimeSecrets.js").resolvePlainOrSecretArn;
let clearRuntimeSecretsCacheForTests: typeof import("./runtimeSecrets.js").clearRuntimeSecretsCacheForTests;

beforeEach(async () => {
  sendMock.mockReset();
  vi.resetModules();
  const mod = await import("./runtimeSecrets.js");
  resolvePlainOrSecretArn = mod.resolvePlainOrSecretArn;
  clearRuntimeSecretsCacheForTests = mod.clearRuntimeSecretsCacheForTests;
});

afterEach(() => {
  clearRuntimeSecretsCacheForTests();
  vi.useRealTimers();
});

describe("resolvePlainOrSecretArn", () => {
  it("returns plain inline value when provided (no Secrets Manager call)", async () => {
    const v = await resolvePlainOrSecretArn("inline-key", "arn:ignored");
    expect(v).toBe("inline-key");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns empty string when both inline and ARN are missing", async () => {
    const v = await resolvePlainOrSecretArn("", "");
    expect(v).toBe("");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("reads a plain-string secret (non-JSON) verbatim", async () => {
    sendMock.mockResolvedValue({ SecretString: "raw-key-value" });
    const v = await resolvePlainOrSecretArn("", "arn:aws:secretsmanager:::secret:plain");
    expect(v).toBe("raw-key-value");
  });

  it("with no preferredField, walks the default fallback chain (apiKey first)", async () => {
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ apiKey: "from-apiKey", azureSpeechKey: "from-speech" }),
    });
    const v = await resolvePlainOrSecretArn("", "arn:aws:secretsmanager:::secret:openai");
    expect(v).toBe("from-apiKey");
  });

  it("with preferredField=azureTranslationKey, picks translation key over speech key in shared secret", async () => {
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({
        azureSpeechKey: "speech-secret",
        azureTranslationKey: "translation-secret",
      }),
    });
    const v = await resolvePlainOrSecretArn(
      "",
      "arn:aws:secretsmanager:::secret:azure-multilingual",
      { preferredField: "azureTranslationKey" },
    );
    expect(v).toBe("translation-secret");
  });

  it("with preferredField=azureSpeechKey, picks speech key from same shared secret", async () => {
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({
        azureSpeechKey: "speech-secret",
        azureTranslationKey: "translation-secret",
      }),
    });
    const v = await resolvePlainOrSecretArn(
      "",
      "arn:aws:secretsmanager:::secret:azure-multilingual",
      { preferredField: "azureSpeechKey" },
    );
    expect(v).toBe("speech-secret");
  });

  it("falls back to default chain when preferredField is not present in JSON", async () => {
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ apiKey: "fallback-apiKey" }),
    });
    const v = await resolvePlainOrSecretArn("", "arn:aws:secretsmanager:::secret:partial", {
      preferredField: "azureTranslationKey",
    });
    expect(v).toBe("fallback-apiKey");
  });

  it("caches parsed JSON object, allowing different preferredFields against the same ARN", async () => {
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({
        azureSpeechKey: "speech-secret",
        azureTranslationKey: "translation-secret",
      }),
    });
    const arn = "arn:aws:secretsmanager:::secret:shared";
    const speech = await resolvePlainOrSecretArn("", arn, { preferredField: "azureSpeechKey" });
    const translation = await resolvePlainOrSecretArn("", arn, {
      preferredField: "azureTranslationKey",
    });
    expect(speech).toBe("speech-secret");
    expect(translation).toBe("translation-secret");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("returns empty string when JSON has no matching keys at all", async () => {
    sendMock.mockResolvedValue({ SecretString: JSON.stringify({ unrelated: "x" }) });
    const v = await resolvePlainOrSecretArn("", "arn:aws:secretsmanager:::secret:none");
    expect(v).toBe("");
  });

  it("decodes SecretBinary when SecretString is empty", async () => {
    const buf = Buffer.from(JSON.stringify({ apiKey: "binary-key" }), "utf8");
    sendMock.mockResolvedValue({ SecretString: "", SecretBinary: buf });
    const v = await resolvePlainOrSecretArn("", "arn:aws:secretsmanager:::secret:binary");
    expect(v).toBe("binary-key");
  });

  it("picks apiKey from rapid-cortex/ai/anthropic JSON shape", async () => {
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ apiKey: "sk-ant-platform" }),
    });
    const v = await resolvePlainOrSecretArn("", "arn:aws:secretsmanager:::secret:rapid-cortex/ai/anthropic", {
      preferredField: "apiKey",
    });
    expect(v).toBe("sk-ant-platform");
  });

  it("re-fetches from Secrets Manager after the 5-minute cache TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T00:00:00.000Z"));
    sendMock
      .mockResolvedValueOnce({ SecretString: JSON.stringify({ apiKey: "v1" }) })
      .mockResolvedValueOnce({ SecretString: JSON.stringify({ apiKey: "v2-rotated" }) });
    const arn = "arn:aws:secretsmanager:::secret:rapid-cortex/ai/anthropic";
    expect(await resolvePlainOrSecretArn("", arn, { preferredField: "apiKey" })).toBe("v1");
    vi.setSystemTime(new Date("2026-08-28T00:04:59.000Z"));
    expect(await resolvePlainOrSecretArn("", arn, { preferredField: "apiKey" })).toBe("v1");
    expect(sendMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-08-28T00:05:00.000Z"));
    expect(await resolvePlainOrSecretArn("", arn, { preferredField: "apiKey" })).toBe("v2-rotated");
    expect(sendMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("forceRefresh bypasses cache so a rotated secret is used immediately", async () => {
    sendMock
      .mockResolvedValueOnce({ SecretString: JSON.stringify({ apiKey: "v1" }) })
      .mockResolvedValueOnce({ SecretString: JSON.stringify({ apiKey: "v2-rotated" }) });
    const arn = "arn:aws:secretsmanager:::secret:anthropic-refresh";
    expect(await resolvePlainOrSecretArn("", arn, { preferredField: "apiKey" })).toBe("v1");
    expect(
      await resolvePlainOrSecretArn("", arn, { preferredField: "apiKey", forceRefresh: true }),
    ).toBe("v2-rotated");
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});

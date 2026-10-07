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

  it("ignores empty-string fields and falls through to non-empty ones", async () => {
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({
        azureTranslationKey: "  ",
        azureSpeechKey: "real-speech",
      }),
    });
    const v = await resolvePlainOrSecretArn("", "arn:aws:secretsmanager:::secret:emptyfield", {
      preferredField: "azureTranslationKey",
    });
    expect(v).toBe("real-speech");
  });
});

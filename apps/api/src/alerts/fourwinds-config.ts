import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { FourwindsClient, fourwindsMockEnabled } from "rapid-cortex-integrations";
import { env } from "../lib/env.js";

type FourwindsSecret = {
  apiKey?: string;
  clientId?: string;
  baseUrl?: string;
  html5FallbackBaseUrl?: string;
};

let cached: FourwindsClient | null = null;

function isPlaceholderApiKey(apiKey: string): boolean {
  const k = apiKey.trim().toLowerCase();
  if (!k) return true;
  return (
    k.includes("placeholder") ||
    k === "changeme" ||
    k === "replace_me" ||
    k === "your_api_key_here"
  );
}

export async function getFourwindsClient(): Promise<FourwindsClient | null> {
  if (!env.enableFourwinds) return null;
  if (cached) return cached;

  let apiKey = "";
  let clientId: string | undefined;
  let baseUrl = env.fourwindsApiBaseUrl;

  if (env.fourwindsSecretArn) {
    try {
      const sm = new SecretsManagerClient({});
      const out = await sm.send(new GetSecretValueCommand({ SecretId: env.fourwindsSecretArn }));
      const parsed = JSON.parse(out.SecretString ?? "{}") as FourwindsSecret;
      apiKey = parsed.apiKey?.trim() ?? "";
      clientId = parsed.clientId?.trim() || undefined;
      baseUrl = parsed.baseUrl?.trim() || baseUrl;
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "fourwinds_secret_read_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const mock =
    fourwindsMockEnabled() ||
    !env.fourwindsSecretArn ||
    isPlaceholderApiKey(apiKey) ||
    !baseUrl;

  cached = new FourwindsClient({
    baseUrl,
    apiKey,
    clientId,
    mock,
  });
  return cached;
}

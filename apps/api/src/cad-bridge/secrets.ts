import { isCadBridgeSecretArn } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { resolvePlainOrSecretArn } from "../lib/runtimeSecrets.js";

const MOCK_SECRET = "cad-bridge-mock";

export async function resolveCadBridgeSecret(
  secretArn: string,
  preferredField: "apiKey" | "webhookSecret",
): Promise<string> {
  const arn = secretArn.trim();
  if (!arn) {
    if (env.cadBridgeMock) return MOCK_SECRET;
    throw new Error("CAD bridge secret ARN is empty");
  }
  if (!isCadBridgeSecretArn(arn)) {
    throw new Error("CAD bridge secret ARN is outside rapid-cortex/cad-bridge/ or rc-cad-bridge/");
  }
  return resolvePlainOrSecretArn("", arn, { preferredField });
}

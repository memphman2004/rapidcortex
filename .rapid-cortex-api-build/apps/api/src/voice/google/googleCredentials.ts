import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

export type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

export async function resolveGoogleServiceAccountCredentials(
  cfg: MultilingualVoiceConfig,
): Promise<GoogleServiceAccountCredentials> {
  const inline = cfg.googleApplicationCredentialsJson.trim();
  const fromSecret = inline
    ? inline
    : await resolvePlainOrSecretArn(undefined, cfg.googleCredentialsSecretArn || undefined);
  if (!fromSecret) {
    throw new VoiceProviderError("Google credentials missing", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
      retryable: false,
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromSecret) as unknown;
  } catch (e) {
    throw new VoiceProviderError("Google credentials JSON invalid", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
      cause: e,
      retryable: false,
    });
  }
  const o = parsed as Record<string, unknown>;
  const client_email = typeof o.client_email === "string" ? o.client_email : "";
  const private_key = typeof o.private_key === "string" ? o.private_key : "";
  const project_id = typeof o.project_id === "string" ? o.project_id : undefined;
  if (!client_email || !private_key) {
    throw new VoiceProviderError("Google service account fields missing", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
      retryable: false,
    });
  }
  return { client_email, private_key, project_id };
}

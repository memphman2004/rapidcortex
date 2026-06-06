import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import type { RingOAuthTokens } from "./ring-types.js";
import { RingTokenExpiredError } from "./ring-errors.js";
import { RING_KMS_KEY_ID, RING_SECRETS_PREFIX } from "./ring-env.js";

function secretName(agencyId: string, userId: string): string {
  return `${RING_SECRETS_PREFIX}/${agencyId}/${userId}`;
}

function parseStoredTokens(raw: string): RingOAuthTokens {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RingTokenExpiredError("Ring token secret is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new RingTokenExpiredError("Ring token secret has invalid shape");
  }
  const record = parsed as Record<string, unknown>;
  const accessToken = String(record.accessToken ?? "");
  const refreshToken = String(record.refreshToken ?? "");
  const expiresAt = Number(record.expiresAt);
  const scope = String(record.scope ?? "");
  if (!accessToken || !Number.isFinite(expiresAt)) {
    throw new RingTokenExpiredError("Ring token secret is missing required fields");
  }
  return { accessToken, refreshToken, expiresAt, scope };
}

function serializeTokens(tokens: RingOAuthTokens): string {
  return JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
  });
}

export class RingTokenStore {
  private readonly client: SecretsManagerClient;

  constructor(client?: SecretsManagerClient) {
    this.client = client ?? new SecretsManagerClient({});
  }

  async storeTokens(agencyId: string, userId: string, tokens: RingOAuthTokens): Promise<string> {
    const name = secretName(agencyId, userId);
    const secretString = serializeTokens(tokens);
    const kmsKeyId = RING_KMS_KEY_ID || undefined;

    try {
      await this.client.send(
        new DescribeSecretCommand({
          SecretId: name,
        }),
      );
      await this.client.send(
        new UpdateSecretCommand({
          SecretId: name,
          SecretString: secretString,
          ...(kmsKeyId ? { KmsKeyId: kmsKeyId } : {}),
        }),
      );
    } catch (err) {
      if (!(err instanceof ResourceNotFoundException)) {
        throw err;
      }
      await this.client.send(
        new CreateSecretCommand({
          Name: name,
          SecretString: secretString,
          ...(kmsKeyId ? { KmsKeyId: kmsKeyId } : {}),
          Tags: [
            { Key: "AgencyId", Value: agencyId },
            { Key: "UserId", Value: userId },
            { Key: "Service", Value: "rapid-cortex-ring" },
          ],
        }),
      );
    }

    return name;
  }

  async getTokens(secretKey: string): Promise<RingOAuthTokens> {
    const out = await this.client.send(
      new GetSecretValueCommand({
        SecretId: secretKey,
      }),
    );
    if (!out.SecretString) {
      throw new RingTokenExpiredError("Ring token secret has no value");
    }
    const tokens = parseStoredTokens(out.SecretString);
    if (tokens.expiresAt < Date.now() && !tokens.refreshToken) {
      throw new RingTokenExpiredError("Ring access token expired and no refresh token is stored");
    }
    return tokens;
  }

  async updateTokens(secretKey: string, tokens: RingOAuthTokens): Promise<void> {
    await this.client.send(
      new PutSecretValueCommand({
        SecretId: secretKey,
        SecretString: serializeTokens(tokens),
      }),
    );
  }

  async deleteTokens(secretKey: string): Promise<void> {
    await this.client.send(
      new DeleteSecretCommand({
        SecretId: secretKey,
        ForceDeleteWithoutRecovery: true,
      }),
    );
  }
}

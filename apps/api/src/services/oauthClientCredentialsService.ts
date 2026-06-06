import { oauthClientCredentialsTokenSchema } from "rapid-cortex-shared";
import { signExternalAccessToken } from "../lib/externalApiJwt.js";
import { hashApiClientSecret, verifyApiClientSecret } from "../lib/externalApiPassword.js";
import { ApiClientRepository, type ApiClientRecord } from "../repositories/apiClientRepository.js";

const repo = new ApiClientRepository();

export type TokenSuccess = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
};

function assertActive(r: ApiClientRecord): void {
  if (r.status !== "active") {
    throw new Error("CLIENT_DISABLED");
  }
}

/** Exchange client credentials for a JWT access token (`POST /api/v1/oauth/token`). */
export async function exchangeClientCredentials(
  parsedBody: unknown,
): Promise<TokenSuccess> {
  const p = oauthClientCredentialsTokenSchema.parse(parsedBody);
  const row = await repo.get(p.client_id);
  if (!row || !verifyApiClientSecret(p.client_secret, row.secretSalt, row.secretHash)) {
    throw new Error("INVALID_CLIENT");
  }
  assertActive(row);
  const ttl = 3600;
  const scopes = [...row.scopes].join(" ");
  const tok = await signExternalAccessToken(
    {
      sub: row.clientId,
      cid: row.agencyId,
      scopes,
      env: row.environment === "sandbox" ? "sandbox" : "production",
    },
    ttl,
  );

  await repo.updateLastUsed(row.clientId, new Date().toISOString());

  return {
    access_token: tok,
    token_type: "Bearer",
    expires_in: ttl,
  };
}

/** Issue a new plaintext secret hash for rotations / initial client creation display. */
export function issueNewPlaintextSecretPair(): {
  plaintext: string;
  saltHex: string;
  hashHex: string;
} {
  /** 32-byte url-safe-ish secret displayed once to admins. */
  const buf = Buffer.alloc(48);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  const plaintext = `rcx_${buf.toString("base64url")}`;
  const { saltHex, hashHex } = hashApiClientSecret(plaintext);
  return { plaintext, saltHex, hashHex };
}

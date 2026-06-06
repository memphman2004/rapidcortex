import { JWT } from "google-auth-library";
import type { GoogleServiceAccountCredentials } from "./googleCredentials.js";

export async function getGoogleAccessToken(
  creds: GoogleServiceAccountCredentials,
  scopes: string[],
): Promise<string> {
  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  });
  const res = await client.getAccessToken();
  const token = typeof res === "string" ? res : res?.token;
  if (!token) {
    throw new Error("Google access token empty");
  }
  return token;
}

import {
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { HUBSPOT_SECRET_NAME } from "rapid-cortex-shared";

const secrets = new SecretsManagerClient({});

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

/** Stores the private app token in Secrets Manager. The leads table only records that it exists. */
export async function storeHubSpotToken(token: string): Promise<void> {
  if (process.env.HUBSPOT_MOCK === "1") return;
  try {
    await secrets.send(
      new PutSecretValueCommand({ SecretId: HUBSPOT_SECRET_NAME, SecretString: token }),
    );
  } catch (error) {
    if (errorName(error) !== "ResourceNotFoundException") throw error;
    await secrets.send(
      new CreateSecretCommand({
        Name: HUBSPOT_SECRET_NAME,
        SecretString: token,
        Description: "NexCort sales CRM HubSpot private app token",
      }),
    );
  }
}

export async function readHubSpotToken(): Promise<string | null> {
  if (process.env.HUBSPOT_MOCK === "1") return "mock-hubspot-token";
  try {
    const out = await secrets.send(new GetSecretValueCommand({ SecretId: HUBSPOT_SECRET_NAME }));
    const token = out.SecretString?.trim();
    return token || null;
  } catch (error) {
    if (errorName(error) === "ResourceNotFoundException") return null;
    throw error;
  }
}

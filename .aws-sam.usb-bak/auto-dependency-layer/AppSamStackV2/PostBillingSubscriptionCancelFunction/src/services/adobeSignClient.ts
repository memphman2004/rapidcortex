import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import {
  adobeSignAgreementFieldsSchema,
  type AdobeSignAgreementFields,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";

type AdobeSignCredentials = {
  clientId: string;
  clientSecret: string;
  webhookToken?: string;
};

let cachedCreds: AdobeSignCredentials | null = null;

async function loadCredentials(): Promise<AdobeSignCredentials | null> {
  if (env.adobeSignMock) {
    return {
      clientId: "mock-adobe-client",
      clientSecret: "mock",
      webhookToken: env.adobeSignWebhookTokenInline || "mock-token",
    };
  }
  const arn = env.adobeSignCredentialsSecretArn;
  if (!arn) return null;
  if (cachedCreds) return cachedCreds;
  const sm = new SecretsManagerClient({ region: env.region });
  const out = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
  const raw = out.SecretString ?? "";
  const parsed = JSON.parse(raw) as Record<string, string>;
  cachedCreds = {
    clientId: parsed.clientId ?? parsed.ADOBE_SIGN_CLIENT_ID ?? "",
    clientSecret: parsed.clientSecret ?? parsed.ADOBE_SIGN_CLIENT_SECRET ?? "",
    webhookToken: parsed.webhookToken ?? parsed.ADOBE_SIGN_WEBHOOK_TOKEN,
  };
  return cachedCreds;
}

export async function getAdobeSignClientId(): Promise<string | null> {
  const c = await loadCredentials();
  return c?.clientId ?? null;
}

export async function verifyAdobeSignWebhookToken(headerToken: string | undefined): Promise<boolean> {
  const c = await loadCredentials();
  if (!c?.webhookToken) return env.adobeSignMock;
  return headerToken === c.webhookToken;
}

export async function getAdobeSignAccessToken(): Promise<string> {
  const c = await loadCredentials();
  if (!c?.clientId || !c.clientSecret) {
    throw new Error("ADOBE_SIGN_NOT_CONFIGURED");
  }
  if (env.adobeSignMock) return "mock-access-token";

  const base = env.adobeSignApiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: c.clientId,
      client_secret: c.clientSecret,
      scope: "agreement_read",
    }),
  });
  if (!res.ok) {
    throw new Error(`ADOBE_SIGN_TOKEN_FAILED:${res.status}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("ADOBE_SIGN_TOKEN_MISSING");
  return data.access_token;
}

export async function fetchAdobeAgreement(
  agreementId: string,
  token: string,
): Promise<Record<string, unknown>> {
  if (env.adobeSignMock) {
    return { id: agreementId, name: "Mock Agreement", status: "SIGNED" };
  }
  const base = env.adobeSignApiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/agreements/${agreementId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ADOBE_SIGN_AGREEMENT_FAILED:${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function fetchAdobeAgreementFormFields(
  agreementId: string,
  token: string,
): Promise<AdobeSignAgreementFields> {
  if (env.adobeSignMock) {
    return adobeSignAgreementFieldsSchema.parse({
      agreement_type: "rc_lite",
      customer_legal_name: "Mock Customer LLC",
      technical_contact_name: "Mock Contact",
      technical_contact_email: "mock@example.com",
      service_tier: "small",
      use_case_description: "mock provisioning",
    });
  }
  const base = env.adobeSignApiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/agreements/${agreementId}/formFields`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ADOBE_SIGN_FORM_FIELDS_FAILED:${res.status}`);
  const data = (await res.json()) as { fields?: Array<{ name?: string; value?: string }> };
  const flat: Record<string, string> = {};
  for (const field of data.fields ?? []) {
    if (field.name && field.value) flat[field.name] = field.value;
  }
  return adobeSignAgreementFieldsSchema.parse(flat);
}

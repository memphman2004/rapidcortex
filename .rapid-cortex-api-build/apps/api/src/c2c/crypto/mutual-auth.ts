import { createSign, createVerify, X509Certificate } from "node:crypto";
import { SignCommand, KMSClient } from "@aws-sdk/client-kms";

export interface MutualAuthConfig {
  caCertPem: string;
  hubCertPem: string;
  hubPrivateKeyArn: string;
}

const kms = new KMSClient({});

export async function verifyAgencyCert(certPem: string, agencyId: string, caCertPem: string): Promise<boolean> {
  try {
    const cert = new X509Certificate(certPem);
    const ca = new X509Certificate(caCertPem);
    if (!cert.checkIssued(ca)) return false;
    const cn = cert.subject.split("\n").find((line) => line.startsWith("CN="))?.slice(3);
    return !cn || cn === agencyId || cn.includes(agencyId);
  } catch {
    return false;
  }
}

export async function signRequest(payload: Buffer, keyArn: string): Promise<Buffer> {
  const signed = await kms.send(
    new SignCommand({
      KeyId: keyArn,
      Message: payload,
      MessageType: "RAW",
      SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
    }),
  );
  if (!signed.Signature) throw new Error("KMS Sign returned empty signature");
  return Buffer.from(signed.Signature);
}

export function verifyLocalSignature(payload: Buffer, signature: Buffer, publicKeyPem: string): boolean {
  const verify = createVerify("RSA-SHA256");
  verify.update(payload);
  verify.end();
  return verify.verify(publicKeyPem, signature);
}

export function signLocal(payload: Buffer, privateKeyPem: string): Buffer {
  const sign = createSign("RSA-SHA256");
  sign.update(payload);
  sign.end();
  return sign.sign(privateKeyPem);
}

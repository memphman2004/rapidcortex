import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { GenerateDataKeyCommand, KMSClient } from "@aws-sdk/client-kms";

export interface EncryptedPayload {
  keyId: string;
  iv: string;
  ciphertext: string;
  encryptedDek: string;
  alg: "AES-256-GCM";
}

const kms = new KMSClient({});

export async function encryptPayload(plaintext: string, keyId: string): Promise<EncryptedPayload> {
  const dataKey = await kms.send(new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: "AES_256" }));
  if (!dataKey.Plaintext || !dataKey.CiphertextBlob) {
    throw new Error("KMS GenerateDataKey returned empty material");
  }
  const dek = Buffer.from(dataKey.Plaintext);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  dek.fill(0);
  return {
    keyId,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    encryptedDek: Buffer.from(dataKey.CiphertextBlob).toString("base64"),
    alg: "AES-256-GCM",
  };
}

export async function decryptPayload(encrypted: EncryptedPayload, _keyId: string): Promise<string> {
  const { DecryptCommand } = await import("@aws-sdk/client-kms");
  const decrypted = await kms.send(
    new DecryptCommand({ CiphertextBlob: Buffer.from(encrypted.encryptedDek, "base64") }),
  );
  if (!decrypted.Plaintext) throw new Error("KMS Decrypt returned empty plaintext");
  const dek = Buffer.from(decrypted.Plaintext);
  const buf = Buffer.from(encrypted.ciphertext, "base64");
  const iv = Buffer.from(encrypted.iv, "base64");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", dek, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  dek.fill(0);
  return plaintext;
}

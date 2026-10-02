import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../lib/env.js";
import { ddb } from "../repositories/baseRepository.js";
import { BillingAuditService } from "./billingAuditService.js";

const s3 = new S3Client({ region: env.region });
const billingAuditService = new BillingAuditService();

const MAX_PO_BYTES = 10 * 1024 * 1024;

export type PoUploadFile = {
  fileName: string;
  contentType: string;
  bytes: Buffer;
};

function assertValidPdfContent(buffer: Buffer): void {
  if (buffer.length < 16) {
    throw new Error("PDF file appears corrupted");
  }
  const header = buffer.subarray(0, 5).toString("utf8");
  if (header !== "%PDF-") {
    throw new Error("File must be a valid PDF");
  }
  const tailWindow = buffer.subarray(Math.max(0, buffer.length - 2048)).toString("utf8");
  if (!tailWindow.includes("%%EOF")) {
    throw new Error("PDF file appears corrupted");
  }
}

function sanitizePdfFilename(input: string): string {
  const base = input.replace(/\.pdf$/i, "").trim() || "purchase-order";
  const safe = base.replace(/[^A-Za-z0-9._-]/g, "_");
  return safe.endsWith(".pdf") ? safe : `${safe}.pdf`;
}

export async function uploadPO(
  invoiceId: string,
  file: PoUploadFile,
  userId = "system",
): Promise<{ s3Key: string; invoiceId: string; customerId: string }> {
  if (!invoiceId?.trim()) throw new Error("invoiceId is required");
  if (!file?.bytes) throw new Error("file is required");

  const isPdfContentType = file.contentType?.toLowerCase() === "application/pdf";
  const isPdfFileName = /\.pdf$/i.test(file.fileName ?? "");
  if (!isPdfContentType && !isPdfFileName) {
    throw new Error("File must be PDF");
  }
  if (file.bytes.length > MAX_PO_BYTES) {
    throw new Error("File size exceeds 10MB limit");
  }
  assertValidPdfContent(file.bytes);

  const invoiceOut = await ddb.send(
    new GetCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
    }),
  );
  const invoice = invoiceOut.Item as { invoiceId?: string; customerId?: string; agencyId?: string } | undefined;
  if (!invoice?.invoiceId || !invoice.customerId) {
    throw new Error("Invoice not found");
  }

  const fileName = sanitizePdfFilename(file.fileName || "purchase-order.pdf");
  const s3Key = `pos/${invoice.customerId}/${invoiceId}/${fileName}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.billingPosBucket,
      Key: s3Key,
      Body: file.bytes,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    }),
  );

  await ddb.send(
    new UpdateCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
      UpdateExpression: "SET poDocumentS3Key = :poDocumentS3Key, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":poDocumentS3Key": s3Key,
        ":updatedAt": new Date().toISOString(),
      },
    }),
  );

  await billingAuditService.logBillingAction("po_uploaded", "invoice", invoiceId, userId, {
    agencyId: invoice.agencyId,
    customerId: invoice.customerId,
    invoiceId,
    s3Key,
    fileName,
    fileSize: file.bytes.length,
  });

  return { s3Key, invoiceId, customerId: invoice.customerId };
}

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../lib/env.js";
import {
  generateInvoicePdfBuffer,
  loadPaymentInstructions,
  type InvoicePdfInvoice,
  type InvoicePdfLineItem,
} from "../lib/billing/invoicePdfGenerator.js";

const s3 = new S3Client({ region: env.region });

type InvoiceLineItem = {
  serviceName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total?: number;
};

type InvoicePayload = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  poNumber?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  currency?: string;
  paymentTerms?: string;
};

type CustomerPayload = {
  customerId: string;
  agencyName: string;
  billingContact?: string;
  email?: string;
  phone?: string;
  address?: string;
};

function asBuffer(body: unknown): Buffer | null {
  if (!body) return null;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  return null;
}

function parseAddress(address?: string): InvoicePdfInvoice["billingAddress"] | undefined {
  if (!address?.trim()) return undefined;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return { street: parts[0] };
  const last = parts[parts.length - 1] ?? "";
  const stateZip = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (stateZip && parts.length >= 2) {
    return {
      street: parts.slice(0, -2).join(", ") || parts[0],
      city: parts[parts.length - 2],
      state: stateZip[1],
      zip: stateZip[2],
    };
  }
  return { street: address };
}

export async function generateInvoicePDF(
  invoice: InvoicePayload,
  customer: CustomerPayload,
  items: InvoiceLineItem[],
): Promise<{ s3Key: string; signedUrl: string }> {
  const paymentInfo = await loadPaymentInstructions();

  const pdfInvoice: InvoicePdfInvoice = {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    customerName: customer.agencyName,
    billingContactName: customer.billingContact,
    billingContactEmail: customer.email,
    billingAddress: parseAddress(customer.address),
    poNumber: invoice.poNumber,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    tax: invoice.tax,
    total: invoice.total,
    currency: invoice.currency,
    paymentTerms: invoice.paymentTerms,
  };

  const pdfItems: InvoicePdfLineItem[] = items.map((item) => ({
    serviceName: item.serviceName,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.total,
  }));

  const pdfBytes = await generateInvoicePdfBuffer(pdfInvoice, pdfItems, paymentInfo);

  const safeInvoiceNumber = invoice.invoiceNumber.replace(/[^A-Za-z0-9-_]/g, "_");
  const s3Key = `invoices/${customer.customerId}/${invoice.invoiceId}/${safeInvoiceNumber}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.billingInvoicesBucket,
      Key: s3Key,
      Body: asBuffer(pdfBytes) ?? pdfBytes,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    }),
  );

  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.billingInvoicesBucket,
      Key: s3Key,
    }),
    { expiresIn: 3600 },
  );

  return { s3Key, signedUrl };
}

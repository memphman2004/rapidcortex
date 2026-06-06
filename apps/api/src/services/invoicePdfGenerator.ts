import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import PDFDocument from "pdfkit";
import { env } from "../lib/env.js";
import { readLogoBuffer } from "../lib/billing/invoicePdfGenerator.js";

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

function money(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function asBuffer(body: unknown): Buffer | null {
  if (!body) return null;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  return null;
}

async function resolveRapidCortexLogo(): Promise<Buffer | null> {
  const embedded = readLogoBuffer("rapid-cortex-logo-2_copy.png") ?? readLogoBuffer("rapid-cortex-logo-2 copy.png");
  if (embedded) return embedded;

  if (!env.assetsBucket) return null;
  const candidates = ["branding/rapid-cortex-logo-2_copy.png", "branding/rapid-cortex-logo-2 copy.png"];
  for (const key of candidates) {
    try {
      const out = await s3.send(new GetObjectCommand({ Bucket: env.assetsBucket, Key: key }));
      const bytes = await out.Body?.transformToByteArray();
      if (bytes) return Buffer.from(bytes);
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

export async function generateInvoicePDF(
  invoice: InvoicePayload,
  customer: CustomerPayload,
  items: InvoiceLineItem[],
): Promise<{ s3Key: string; signedUrl: string }> {
  const pdfBytes = await new Promise<Buffer>(async (resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const logo = await resolveRapidCortexLogo();
    if (logo) {
      doc.image(logo, 50, 40, { fit: [180, 50] });
    }

    doc.font("Helvetica").fontSize(9).fillColor("#444444");
    doc.text("Rapid Cortex", 50, 98);
    doc.text("Apps on Demand LLC", 50, 110);
    doc.text("123 Main Street, Columbus, GA 31901", 50, 122);
    doc.text("Phone: (833) 727-4311", 50, 134);
    doc.text("Email: support@appsondemand.net", 50, 146);

    doc.font("Helvetica-Bold").fontSize(24).fillColor("#2E5090").text("INVOICE", 390, 45, { width: 170, align: "right" });
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#333333").text(`Invoice #: ${invoice.invoiceNumber}`, 390, 78, { width: 170, align: "right" });
    doc.font("Helvetica").fontSize(10).text(`Date: ${invoice.invoiceDate}`, 390, 92, { width: 170, align: "right" });
    doc.text(`Due Date: ${invoice.dueDate}`, 390, 106, { width: 170, align: "right" });
    if (invoice.poNumber) doc.text(`PO #: ${invoice.poNumber}`, 390, 120, { width: 170, align: "right" });

    doc.moveTo(50, 170).lineTo(560, 170).strokeColor("#CCCCCC").lineWidth(1).stroke();

    let y = 186;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#2E5090").text("BILL TO:", 50, y);
    y += 18;
    doc.font("Helvetica").fontSize(10).fillColor("#333333");
    doc.text(customer.agencyName, 50, y);
    y += 14;
    if (customer.billingContact) {
      doc.text(`Billing Contact: ${customer.billingContact}`, 50, y);
      y += 14;
    }
    if (customer.email) {
      doc.text(customer.email, 50, y);
      y += 14;
    }
    if (customer.phone) {
      doc.text(customer.phone, 50, y);
      y += 14;
    }
    if (customer.address) {
      doc.text(customer.address, 50, y);
      y += 14;
    }

    y = Math.max(y + 20, 300);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#2E5090");
    doc.text("SERVICE", 50, y);
    doc.text("DESCRIPTION", 170, y);
    doc.text("QTY", 360, y);
    doc.text("UNIT PRICE", 420, y);
    doc.text("TOTAL", 510, y);
    doc.moveTo(50, y + 14).lineTo(560, y + 14).strokeColor("#2E5090").lineWidth(2).stroke();

    y += 24;
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    for (const item of items) {
      const lineTotal = item.total ?? Number((item.quantity * item.unitPrice).toFixed(2));
      doc.text(item.serviceName.slice(0, 20), 50, y, { width: 110 });
      doc.text((item.description ?? "").slice(0, 35), 170, y, { width: 175 });
      doc.text(String(item.quantity), 360, y);
      doc.text(money(item.unitPrice, invoice.currency ?? "USD"), 420, y);
      doc.text(money(lineTotal, invoice.currency ?? "USD"), 510, y);
      y += 16;
    }

    y += 8;
    doc.moveTo(400, y).lineTo(560, y).strokeColor("#CCCCCC").lineWidth(1).stroke();
    y += 10;
    doc.font("Helvetica").fontSize(10).fillColor("#333333");
    doc.text("Subtotal:", 430, y);
    doc.text(money(invoice.subtotal, invoice.currency ?? "USD"), 480, y, { width: 80, align: "right" });
    y += 16;
    doc.text("Discount:", 430, y);
    doc.text(`-${money(invoice.discount ?? 0, invoice.currency ?? "USD")}`, 480, y, { width: 80, align: "right" });
    y += 16;
    doc.text("Tax:", 430, y);
    doc.text(money(invoice.tax ?? 0, invoice.currency ?? "USD"), 480, y, { width: 80, align: "right" });
    y += 14;
    doc.moveTo(400, y).lineTo(560, y).strokeColor("#2E5090").lineWidth(2).stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#2E5090");
    doc.text("TOTAL DUE:", 400, y);
    doc.text(money(invoice.total, invoice.currency ?? "USD"), 470, y, { width: 90, align: "right" });

    y += 32;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#2E5090").text("Payment Terms", 50, y);
    y += 16;
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    doc.text(invoice.paymentTerms ?? "NET 30", 50, y);
    y += 18;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#2E5090").text("Payment Instructions", 50, y);
    y += 16;
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    doc.text("ACH: Routing XXX-XXX-XXX | Account XXX-XXX-XXX", 50, y);
    y += 12;
    doc.text("Wire: SWIFT XXXXXXXX | Account XXX-XXX-XXX", 50, y);
    y += 12;
    doc.text("Check: Payable to Apps on Demand LLC, 123 Main Street, Columbus, GA 31901", 50, y);

    doc.font("Helvetica").fontSize(8).fillColor("#777777");
    doc.text(
      "By paying this invoice, customer agrees to Rapid Cortex billing terms. For billing support, contact support@appsondemand.net.",
      50,
      735,
      { width: 510 },
    );

    doc.end();
  });

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
    { expiresIn: 900 },
  );

  return { s3Key, signedUrl };
}

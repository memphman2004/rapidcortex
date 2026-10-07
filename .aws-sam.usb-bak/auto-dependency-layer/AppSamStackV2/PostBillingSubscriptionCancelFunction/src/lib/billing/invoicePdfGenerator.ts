import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { env } from "../env.js";

export type InvoicePdfLineItem = {
  serviceName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
};

export type InvoicePdfInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  billingContactName?: string;
  billingContactEmail?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  poNumber?: string;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  currency?: string;
  paymentTerms?: string;
  dueDays?: number;
};

type PaymentInstructions = {
  achRoutingNumber?: string;
  achAccountNumber?: string;
  wireInstructions?: string;
  checkMailingAddress?: string;
  bankName?: string;
  bankContact?: string;
};

const s3 = new S3Client({ region: env.region });
const secretsManager = new SecretsManagerClient({ region: env.region });
let cachedPaymentInstructions: PaymentInstructions | null = null;

function money(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function logoCandidates(fileName: string): string[] {
  const brandingDir = process.env.BILLING_BRANDING_DIR?.trim();
  const base = process.cwd();
  return [
    brandingDir ? path.join(brandingDir, fileName) : "",
    path.join(base, "assets/branding", fileName),
    path.join(base, "apps/api/assets/branding", fileName),
    path.join(base, "apps/web/public", fileName),
  ].filter(Boolean);
}

function resolveLogo(fileName: string): string | null {
  const found = logoCandidates(fileName).find((p) => existsSync(p));
  return found ?? null;
}

function detectRcLiteInvoice(invoice: InvoicePdfInvoice, items: InvoicePdfLineItem[]): boolean {
  const source = `${invoice.invoiceNumber} ${items.map((i) => `${i.serviceName} ${i.description ?? ""}`).join(" ")}`.toLowerCase();
  return ["rc lite", "rc_lite", "rclite", "api access"].some((k) => source.includes(k));
}

function drawWatermark(doc: PDFKit.PDFDocument, logoPath: string | null): void {
  if (!logoPath) return;
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const logoW = pageW * 0.7;
  const logoH = logoW;

  doc.save();
  doc.translate(pageW / 2, pageH / 2);
  doc.rotate(-45, { origin: [0, 0] });
  doc.opacity(0.08);
  doc.image(logoPath, -logoW / 2, -logoH / 2, {
    width: logoW,
    height: logoH,
    fit: [logoW, logoH],
  });
  doc.restore();
  doc.opacity(1);
}

function writePaymentInstructions(
  doc: PDFKit.PDFDocument,
  y: number,
  paymentInstructions?: PaymentInstructions,
): number {
  const pi = paymentInstructions ?? {};
  const bankName = pi.bankName ?? "Navy Federal Credit Union";
  const bankContact = pi.bankContact ?? "billing@rapidcortex.us";
  const achRouting = pi.achRoutingNumber ?? "XXX-XXX-XXX";
  const achAccount = pi.achAccountNumber ?? "XXX-XXX-XXX";
  const wire = pi.wireInstructions ?? "SWIFT: XXXXXXXX / Account: XXX-XXX-XXX";
  const checkAddress = pi.checkMailingAddress ?? "123 Main Street, Columbus, GA 31901";

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#2E5090").text("PAYMENT INSTRUCTIONS:", 50, y);
  y += 18;
  doc.font("Helvetica").fontSize(9).fillColor("#333333");
  doc.text(`ACH: ${bankName} | Routing: ${achRouting} | Account: ${achAccount}`, 50, y);
  y += 12;
  doc.text(`Wire: ${wire}`, 50, y);
  y += 12;
  doc.text(`Check: Make payable to Apps on Demand LLC, ${checkAddress}`, 50, y);
  y += 12;
  doc.text(`Bank contact: ${bankContact}`, 50, y);
  return y + 10;
}

export async function generateInvoicePdfBuffer(
  invoice: InvoicePdfInvoice,
  items: InvoicePdfLineItem[],
  paymentInstructions?: PaymentInstructions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const isRcLite = detectRcLiteInvoice(invoice, items);
    const headerLogo = isRcLite ? resolveLogo("RC_Lite1.png") : resolveLogo("rapid-cortex-logo-2 copy.png");
    const watermarkLogo = isRcLite ? resolveLogo("RC_Lite1.png") : resolveLogo("nowordslogo.png");
    drawWatermark(doc, watermarkLogo);

    if (headerLogo) {
      doc.image(headerLogo, 50, 40, { fit: [180, 50] });
    }

    doc.font("Helvetica").fontSize(9).fillColor("#666666");
    doc.text("Apps on Demand LLC", 50, 98);
    doc.text("DBA: Rapid Cortex", 50, 110);
    doc.text("123 Main Street", 50, 122);
    doc.text("Columbus, GA 31901", 50, 134);
    doc.text("Email: billing@rapidcortex.us", 50, 146);

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
    doc.text(invoice.customerName, 50, y);
    y += 14;
    if (invoice.billingContactName) {
      doc.text(invoice.billingContactName, 50, y);
      y += 14;
    }
    if (invoice.billingContactEmail) {
      doc.text(invoice.billingContactEmail, 50, y);
      y += 14;
    }
    if (invoice.billingAddress) {
      if (invoice.billingAddress.street) {
        doc.text(invoice.billingAddress.street, 50, y);
        y += 14;
      }
      const cityStateZip = [
        invoice.billingAddress.city ?? "",
        invoice.billingAddress.state ?? "",
        invoice.billingAddress.zip ?? "",
      ]
        .join(" ")
        .trim();
      if (cityStateZip) {
        doc.text(cityStateZip, 50, y);
        y += 14;
      }
    }

    y = Math.max(y + 20, 300);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#2E5090");
    doc.text("DESCRIPTION", 50, y);
    doc.text("QTY", 360, y);
    doc.text("UNIT PRICE", 420, y);
    doc.text("TOTAL", 510, y);
    doc.moveTo(50, y + 14).lineTo(560, y + 14).strokeColor("#2E5090").lineWidth(2).stroke();

    y += 24;
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    for (const item of items) {
      const lineTotal = item.lineTotal ?? Number((item.quantity * item.unitPrice).toFixed(2));
      doc.text(item.serviceName.slice(0, 52), 50, y, { width: 300 });
      doc.text(String(item.quantity), 360, y);
      doc.text(money(item.unitPrice, invoice.currency ?? "USD"), 420, y);
      doc.text(money(lineTotal, invoice.currency ?? "USD"), 510, y);
      y += 13;
      if (item.description) {
        doc.font("Helvetica").fontSize(8).fillColor("#666666");
        doc.text(item.description.slice(0, 70), 50, y, { width: 310 });
        doc.font("Helvetica").fontSize(9).fillColor("#333333");
        y += 14;
      }
      y += 8;
    }

    y += 6;
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
    doc.text("TOTAL:", 430, y);
    doc.text(money(invoice.total, invoice.currency ?? "USD"), 470, y, { width: 90, align: "right" });

    y += 34;
    y = writePaymentInstructions(doc, y, paymentInstructions);

    doc.font("Helvetica").fontSize(8).fillColor("#999999");
    doc.text(
      `Payment Terms: ${invoice.paymentTerms ?? "NET 30"} - Payment due within ${invoice.dueDays ?? 30} days of invoice date.`,
      50,
      y,
    );
    y += 12;
    doc.text("Late payments may incur interest charges. Please reference invoice number on all payments.", 50, y);
    y += 12;
    doc.text("Questions? Contact billing@rapidcortex.us", 50, y);

    doc.end();
  });
}

export async function uploadInvoicePdfToS3(
  pdfBytes: Buffer,
  invoiceId: string,
  agencyId: string,
): Promise<string> {
  const key = `invoices/${agencyId}/${invoiceId}/${invoiceId}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.billingInvoicesBucket,
      Key: key,
      Body: pdfBytes,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    }),
  );
  return key;
}

export function loadPaymentInstructionsFromEnv(): PaymentInstructions {
  return {
    achRoutingNumber: process.env.ACH_ROUTING_NUMBER,
    achAccountNumber: process.env.ACH_ACCOUNT_NUMBER,
    wireInstructions:
      process.env.WIRE_INSTRUCTIONS ??
      [process.env.WIRE_SWIFT_CODE, process.env.WIRE_ACCOUNT_NUMBER]
        .filter(Boolean)
        .join(" / "),
    checkMailingAddress: process.env.CHECK_MAIL_TO ?? process.env.CHECK_MAILING_ADDRESS,
    bankName: process.env.BANK_NAME,
    bankContact: process.env.BANK_CONTACT,
  };
}

function mapSecretToPaymentInstructions(secret: Record<string, unknown>): PaymentInstructions {
  const wireFromParts = [secret.WIRE_SWIFT_CODE, secret.WIRE_ACCOUNT_NUMBER]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" / ");
  return {
    achRoutingNumber:
      (typeof secret.ACH_ROUTING_NUMBER === "string" ? secret.ACH_ROUTING_NUMBER : undefined) ??
      process.env.ACH_ROUTING_NUMBER,
    achAccountNumber:
      (typeof secret.ACH_ACCOUNT_NUMBER === "string" ? secret.ACH_ACCOUNT_NUMBER : undefined) ??
      process.env.ACH_ACCOUNT_NUMBER,
    wireInstructions:
      (typeof secret.WIRE_INSTRUCTIONS === "string" ? secret.WIRE_INSTRUCTIONS : undefined) ??
      wireFromParts ??
      process.env.WIRE_INSTRUCTIONS,
    checkMailingAddress:
      (typeof secret.CHECK_MAIL_TO === "string" ? secret.CHECK_MAIL_TO : undefined) ??
      process.env.CHECK_MAIL_TO ??
      process.env.CHECK_MAILING_ADDRESS,
    bankName:
      (typeof secret.BANK_NAME === "string" ? secret.BANK_NAME : undefined) ??
      "Navy Federal Credit Union",
    bankContact: typeof secret.BANK_CONTACT === "string" ? secret.BANK_CONTACT : process.env.BANK_CONTACT,
  };
}

export async function loadPaymentInstructions(): Promise<PaymentInstructions> {
  if (cachedPaymentInstructions) return cachedPaymentInstructions;

  const environment = (process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "").toLowerCase();
  const isProduction = environment === "production";
  if (!isProduction || !env.billingPaymentInstructionsSecretArn) {
    cachedPaymentInstructions = loadPaymentInstructionsFromEnv();
    return cachedPaymentInstructions;
  }

  try {
    const result = await secretsManager.send(
      new GetSecretValueCommand({
        SecretId: env.billingPaymentInstructionsSecretArn,
      }),
    );
    const raw = result.SecretString ? (JSON.parse(result.SecretString) as Record<string, unknown>) : {};
    cachedPaymentInstructions = mapSecretToPaymentInstructions(raw);
    return cachedPaymentInstructions;
  } catch (error) {
    console.error(
      "Failed to retrieve billing payment instructions secret; using fallback values.",
      error instanceof Error ? error.message : "unknown-error",
    );
    cachedPaymentInstructions = loadPaymentInstructionsFromEnv();
    return cachedPaymentInstructions;
  }
}

export function readLogoBuffer(fileName: string): Buffer | null {
  const resolved = resolveLogo(fileName);
  if (!resolved) return null;
  return readFileSync(resolved);
}

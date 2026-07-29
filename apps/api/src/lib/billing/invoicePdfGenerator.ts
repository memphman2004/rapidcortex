import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { env } from "../env.js";
import { normalizePaymentInstructions } from "./payment-instructions.js";

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
  // Compiled file lives at dist/lib/billing → ../../../assets/branding in the Lambda package.
  const moduleBranding = path.join(__dirname, "../../../assets/branding", fileName);
  return [
    brandingDir ? path.join(brandingDir, fileName) : "",
    moduleBranding,
    path.join(base, "assets/branding", fileName),
    path.join(base, "apps/api/assets/branding", fileName),
    path.join(base, "apps/web/public/Logo", fileName),
    path.join(base, "apps/web/public", fileName),
    path.join(base, "apps/marketing/public/Logo", fileName),
  ].filter(Boolean);
}

function resolveLogo(fileName: string): string | null {
  return logoCandidates(fileName).find((p) => existsSync(p)) ?? null;
}

function detectRcLiteInvoice(invoice: InvoicePdfInvoice, items: InvoicePdfLineItem[]): boolean {
  const source = `${invoice.invoiceNumber} ${items
    .map((i) => `${i.serviceName} ${i.description ?? ""}`)
    .join(" ")}`.toLowerCase();
  return ["rc lite", "rc_lite", "rclite", "api access"].some((k) => source.includes(k));
}

function drawWatermark(doc: PDFKit.PDFDocument, logoPath: string | null): void {
  if (!logoPath) return;
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const logoW = pageW * 0.65;
  doc.save();
  doc.translate(pageW / 2, pageH / 2);
  doc.rotate(-40, { origin: [0, 0] });
  doc.opacity(0.04);
  doc.image(logoPath, -logoW / 2, -logoW * 0.33, { width: logoW });
  doc.restore();
  doc.opacity(1);
}

export async function generateInvoicePdfBuffer(
  invoice: InvoicePdfInvoice,
  items: InvoicePdfLineItem[],
  paymentInstructions?: PaymentInstructions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // ── Palette (RC brand) ────────────────────────────────────────────────
    const NAVY = "#0A1628";
    const NAVY2 = "#193868";
    const BLUE = "#2563EB";
    const RED = "#DC2626";
    const ALT = "#F0F5FF";
    const WHITE = "#FFFFFF";
    const T1 = "#0F172A";
    const T2 = "#374151";
    const T3 = "#6B7280";
    const BD = "#E2E8F0";
    const HDRSKY = "#BFDBFE";

    // ── Page layout ───────────────────────────────────────────────────────
    const PW = 612;
    const PH = 792;
    const ML = 50;
    const MR = 562;
    const CW = 512;
    const C_DESC = { x: ML, w: 268 };
    const C_QTY = { x: 328, w: 52 };
    const C_PRICE = { x: 388, w: 92 };
    const C_TOTAL = { x: 488, w: 74 };

    const doc = new PDFDocument({ size: "LETTER", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const cur = invoice.currency ?? "USD";
    const isRcLite = detectRcLiteInvoice(invoice, items);
    const logoPath = isRcLite
      ? resolveLogo("RC_Lite1.png")
      : (resolveLogo("rapid-cortex-logo-transparent.png") ??
        resolveLogo("rapid-cortex-logo-2 copy.png") ??
        resolveLogo("rapid-cortex-logo-2.png"));
    const watermarkLogo = isRcLite ? resolveLogo("RC_Lite1.png") : resolveLogo("nowordslogo.png");

    function startPage(): void {
      drawWatermark(doc, watermarkLogo);
    }
    startPage();

    // ── HEADER ───────────────────────────────────────────────────────────
    const HDR_H = 116;
    doc.rect(0, 0, PW, HDR_H).fill(NAVY);

    const LBOX_X = ML - 4;
    const LBOX_Y = 14;
    const LBOX_W = 184;
    const LBOX_H = 88;
    doc.roundedRect(LBOX_X, LBOX_Y, LBOX_W, LBOX_H, 6).fill(WHITE);
    if (logoPath) {
      doc.image(logoPath, LBOX_X + 5, LBOX_Y + 5, {
        fit: [LBOX_W - 10, LBOX_H - 10],
        align: "center",
        valign: "center",
      });
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(NAVY2)
        .text("RAPID", LBOX_X + 6, LBOX_Y + 24, { width: LBOX_W - 12, align: "center" });
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(RED)
        .text("CORTEX", LBOX_X + 6, LBOX_Y + 44, { width: LBOX_W - 12, align: "center" });
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(40)
      .fillColor(WHITE)
      .text("INVOICE", 240, 16, { width: MR - 240, align: "right" });
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(HDRSKY)
      .text(`No.  ${invoice.invoiceNumber}`, 240, 70, { width: MR - 240, align: "right" });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#93C5FD")
      .text(`Issued ${invoice.invoiceDate}   ·   Due ${invoice.dueDate}`, 240, 86, {
        width: MR - 240,
        align: "right",
      });

    // ── ACCENT STRIPES ───────────────────────────────────────────────────
    doc.rect(0, HDR_H, PW, 4).fill(RED);
    doc.rect(0, HDR_H + 4, PW, 2).fill(BLUE);

    // ── INFO SECTION ─────────────────────────────────────────────────────
    const INFO_TOP = HDR_H + 22;
    const C2X = ML + Math.floor(CW / 2) + 14;

    let fromY = INFO_TOP;
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(BLUE)
      .text("FROM", ML, fromY, { characterSpacing: 1.5 });
    fromY += 15;
    doc
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(T1)
      .text("Apps on Demand LLC", ML, fromY, { width: C2X - ML - 10 });
    fromY += 15;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(T2)
      .text("d/b/a Rapid Cortex", ML, fromY, { width: C2X - ML - 10 });
    fromY += 13;
    doc.text("Columbus, GA 31901", ML, fromY, { width: C2X - ML - 10 });
    fromY += 13;
    doc.fillColor(BLUE).text("billing@rapidcortex.us", ML, fromY, { width: C2X - ML - 10 });
    fromY += 13;

    let billY = INFO_TOP;
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(BLUE)
      .text("BILL TO", C2X, billY, { characterSpacing: 1.5 });
    billY += 15;
    doc
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(T1)
      .text(invoice.customerName, C2X, billY, { width: MR - C2X });
    billY += 15;
    doc.font("Helvetica").fontSize(9).fillColor(T2);
    if (invoice.billingContactName) {
      doc.text(invoice.billingContactName, C2X, billY, { width: MR - C2X });
      billY += 13;
    }
    if (invoice.billingContactEmail) {
      doc.fillColor(BLUE).text(invoice.billingContactEmail, C2X, billY, { width: MR - C2X });
      doc.fillColor(T2);
      billY += 13;
    }
    if (invoice.billingAddress) {
      const { street, city, state, zip } = invoice.billingAddress;
      if (street) {
        doc.text(street, C2X, billY, { width: MR - C2X });
        billY += 13;
      }
      const csz = [city, state, zip].filter(Boolean).join(", ");
      if (csz) {
        doc.text(csz, C2X, billY, { width: MR - C2X });
        billY += 13;
      }
    }

    const PILL_Y = Math.max(fromY, billY) + 8;
    const PILL_H = 18;
    doc.roundedRect(ML - 1, PILL_Y, 76, PILL_H, 3).fill(ALT);
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(BLUE)
      .text(invoice.paymentTerms ?? "NET 30", ML + 5, PILL_Y + 5, { width: 64 });
    if (invoice.poNumber) {
      doc.roundedRect(ML + 82, PILL_Y, 120, PILL_H, 3).fill(ALT);
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(BLUE)
        .text(`PO: ${invoice.poNumber}`, ML + 87, PILL_Y + 5, { width: 108 });
    }

    const SEP_Y = PILL_Y + PILL_H + 14;
    doc.moveTo(ML, SEP_Y).lineTo(MR, SEP_Y).strokeColor(BD).lineWidth(0.5).stroke();

    // ── TABLE ────────────────────────────────────────────────────────────
    const TBL_Y = SEP_Y + 14;
    const TH_H_TABLE = 28;

    function drawTableHeader(y: number): void {
      doc.rect(ML, y, CW, TH_H_TABLE).fill(NAVY2);
      const ty = y + 9;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE);
      doc.text("DESCRIPTION", C_DESC.x + 4, ty, { width: C_DESC.w });
      doc.text("QTY", C_QTY.x, ty, { width: C_QTY.w, align: "center" });
      doc.text("UNIT PRICE", C_PRICE.x, ty, { width: C_PRICE.w, align: "right" });
      doc.text("TOTAL", C_TOTAL.x, ty, { width: C_TOTAL.w, align: "right" });
    }

    drawTableHeader(TBL_Y);
    let ry = TBL_Y + TH_H_TABLE;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]!;
      const lineTotal = item.lineTotal ?? Number((item.quantity * item.unitPrice).toFixed(2));
      const hasDesc = Boolean(item.description?.trim());
      const rowH = hasDesc ? 38 : 26;

      if (ry + rowH > PH - 230) {
        doc.addPage();
        startPage();
        drawTableHeader(40);
        ry = 40 + TH_H_TABLE;
      }

      doc.rect(ML, ry, CW, rowH).fill(idx % 2 === 0 ? WHITE : ALT);
      if (idx % 2 !== 0) doc.rect(ML, ry, 3, rowH).fill(BD);

      const nameY = ry + 7;
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(T1)
        .text(item.serviceName.slice(0, 56), C_DESC.x + 5, nameY, { width: C_DESC.w - 5 });
      if (hasDesc) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(T3)
          .text((item.description ?? "").slice(0, 78), C_DESC.x + 5, nameY + 14, {
            width: C_DESC.w - 5,
          });
      }

      const numY = ry + (hasDesc ? 14 : 7);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(T2)
        .text(String(item.quantity), C_QTY.x, numY, { width: C_QTY.w, align: "center" });
      doc.text(money(item.unitPrice, cur), C_PRICE.x, numY, { width: C_PRICE.w, align: "right" });
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(T1)
        .text(money(lineTotal, cur), C_TOTAL.x, numY, { width: C_TOTAL.w, align: "right" });

      doc
        .moveTo(ML, ry + rowH)
        .lineTo(MR, ry + rowH)
        .strokeColor(BD)
        .lineWidth(0.3)
        .stroke();
      ry += rowH;
    }

    doc.moveTo(ML, ry).lineTo(MR, ry).strokeColor(NAVY2).lineWidth(1.5).stroke();
    ry += 18;

    // ── TOTALS ───────────────────────────────────────────────────────────
    const TOT_X = 354;
    const TOT_W = MR - TOT_X;
    const totRows: Array<[string, string]> = [
      ["Subtotal", money(invoice.subtotal, cur)],
      ["Discount", invoice.discount ? `-${money(invoice.discount, cur)}` : money(0, cur)],
      ["Tax", money(invoice.tax ?? 0, cur)],
    ];
    for (const [label, val] of totRows) {
      doc.font("Helvetica").fontSize(9.5).fillColor(T2).text(label, TOT_X, ry, { width: 98 });
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(T1)
        .text(val, TOT_X + 98, ry, { width: TOT_W - 98, align: "right" });
      ry += 16;
    }
    ry += 3;
    doc.moveTo(TOT_X, ry).lineTo(MR, ry).strokeColor(NAVY2).lineWidth(1).stroke();
    ry += 5;

    doc.rect(TOT_X - 10, ry - 4, TOT_W + 10, 34).fill(NAVY);
    doc
      .font("Helvetica-Bold")
      .fontSize(11.5)
      .fillColor(WHITE)
      .text("TOTAL DUE", TOT_X, ry + 8, { width: 98 });
    doc
      .font("Helvetica-Bold")
      .fontSize(12.5)
      .fillColor(WHITE)
      .text(money(invoice.total, cur), TOT_X + 98, ry + 8, {
        width: TOT_W - 98,
        align: "right",
      });
    ry += 50;

    // ── PAYMENT INSTRUCTIONS ─────────────────────────────────────────────
    if (ry > PH - 215) {
      doc.addPage();
      startPage();
      ry = 50;
    }

    doc.rect(ML, ry, CW, 26).fill(NAVY2);
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(WHITE)
      .text("PAYMENT INSTRUCTIONS", ML + 8, ry + 9, { characterSpacing: 1.2 });
    ry += 34;

    const pi = paymentInstructions ?? {};
    const bankName = pi.bankName ?? "";
    const achRouting = pi.achRoutingNumber ?? "";
    const achAccount = pi.achAccountNumber ?? "";
    const wire = pi.wireInstructions ?? "";
    const checkAddr = pi.checkMailingAddress ?? "";
    const bankContact = pi.bankContact ?? "billing@rapidcortex.us";

    const PIW = Math.floor(CW / 3) - 8;
    const PI_BOX_H = 76;
    const piCols: Array<{ title: string; lines: string[] }> = [
      {
        title: "ACH TRANSFER",
        lines: [
          bankName,
          achRouting ? `Routing: ${achRouting}` : "",
          achAccount ? `Account: ${achAccount}` : "",
        ].filter(Boolean),
      },
      { title: "WIRE TRANSFER", lines: [wire].filter(Boolean) },
      {
        title: "CHECK / MAIL",
        lines: ["Payable to: Apps on Demand LLC", checkAddr].filter(Boolean),
      },
    ];

    const PI_START_Y = ry;
    let piMaxY = PI_START_Y;
    for (let ci = 0; ci < 3; ci++) {
      const col = piCols[ci]!;
      const cx = ML + ci * (PIW + 10);
      doc.roundedRect(cx, PI_START_Y, PIW, PI_BOX_H, 5).fill("#F8FAFF");
      doc.roundedRect(cx, PI_START_Y, PIW, PI_BOX_H, 5).strokeColor(BD).lineWidth(0.6).stroke();
      doc.roundedRect(cx, PI_START_Y, 3, PI_BOX_H, 2).fill(BLUE);
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor(BLUE)
        .text(col.title, cx + 10, PI_START_Y + 10, { characterSpacing: 0.8, width: PIW - 16 });
      doc
        .moveTo(cx + 10, PI_START_Y + 23)
        .lineTo(cx + PIW - 8, PI_START_Y + 23)
        .strokeColor(BD)
        .lineWidth(0.5)
        .stroke();
      let lineY = PI_START_Y + 29;
      for (const line of col.lines) {
        doc
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(T2)
          .text(line, cx + 10, lineY, { width: PIW - 16 });
        lineY += 13;
      }
      if (lineY > piMaxY) piMaxY = lineY;
    }
    ry = piMaxY + 16;

    doc.font("Helvetica").fontSize(8).fillColor(T3).text(`Billing inquiries: ${bankContact}`, ML, ry);
    ry += 22;

    // ── TERMS ────────────────────────────────────────────────────────────
    doc.moveTo(ML, ry).lineTo(MR, ry).strokeColor(BD).lineWidth(0.5).stroke();
    ry += 10;
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(T3)
      .text(
        `Payment Terms: ${invoice.paymentTerms ?? "NET 30"} — payment due within ` +
          `${invoice.dueDays ?? 30} days of invoice date. Late payments may incur interest ` +
          `charges per applicable law. Please reference invoice number ${invoice.invoiceNumber} ` +
          `on all payments and remittances.`,
        ML,
        ry,
        { width: CW },
      );

    // ── FOOTER ───────────────────────────────────────────────────────────
    const FOOT_H = 34;
    const FOOT_Y = PH - FOOT_H;
    doc.rect(0, FOOT_Y - 4, PW, 2).fill(RED);
    doc.rect(0, FOOT_Y - 2, PW, 2).fill(BLUE);
    doc.rect(0, FOOT_Y, PW, FOOT_H).fill(NAVY);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(HDRSKY)
      .text(
        "Apps on Demand LLC  d/b/a Rapid Cortex  ·  Columbus, GA 31901  ·  billing@rapidcortex.us  ·  rapidcortex.us",
        0,
        FOOT_Y + 8,
        { width: PW, align: "center" },
      );
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#475569")
      .text("Intelligence at the Speed of Response", 0, FOOT_Y + 20, {
        width: PW,
        align: "center",
      });

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
      [process.env.WIRE_SWIFT_CODE, process.env.WIRE_ACCOUNT_NUMBER].filter(Boolean).join(" / "),
    checkMailingAddress: process.env.CHECK_MAIL_TO ?? process.env.CHECK_MAILING_ADDRESS,
    bankName: process.env.BANK_NAME,
    bankContact: process.env.BANK_CONTACT,
  };
}

function mapSecretToPaymentInstructions(secret: Record<string, unknown>): PaymentInstructions {
  const normalized = normalizePaymentInstructions({
    ...secret,
    ACH_ROUTING_NUMBER: secret.ACH_ROUTING_NUMBER ?? process.env.ACH_ROUTING_NUMBER,
    ACH_ACCOUNT_NUMBER: secret.ACH_ACCOUNT_NUMBER ?? process.env.ACH_ACCOUNT_NUMBER,
    WIRE_INSTRUCTIONS: secret.WIRE_INSTRUCTIONS ?? process.env.WIRE_INSTRUCTIONS,
    CHECK_MAIL_TO:
      secret.CHECK_MAIL_TO ?? process.env.CHECK_MAIL_TO ?? process.env.CHECK_MAILING_ADDRESS,
    BANK_NAME: secret.BANK_NAME ?? process.env.BANK_NAME,
    BANK_CONTACT: secret.BANK_CONTACT ?? process.env.BANK_CONTACT,
  });
  return {
    achRoutingNumber: normalized.achRoutingNumber || undefined,
    achAccountNumber: normalized.achAccountNumber || undefined,
    wireInstructions: normalized.wireInstructions || undefined,
    checkMailingAddress: normalized.checkMailingAddress || undefined,
    bankName: normalized.bankName || undefined,
    bankContact: normalized.bankContact || undefined,
  };
}

/**
 * Load banking / ACH / wire / check instructions for invoice PDF + email.
 * Prefers Secrets Manager whenever BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN is set
 * (any stage — not production-only). Env vars remain a local/dev fallback.
 */
export async function loadPaymentInstructions(): Promise<PaymentInstructions> {
  if (cachedPaymentInstructions) return cachedPaymentInstructions;
  const secretArn = env.billingPaymentInstructionsSecretArn?.trim();
  if (!secretArn) {
    cachedPaymentInstructions = loadPaymentInstructionsFromEnv();
    return cachedPaymentInstructions;
  }
  try {
    const result = await secretsManager.send(
      new GetSecretValueCommand({ SecretId: secretArn }),
    );
    const raw = result.SecretString
      ? (JSON.parse(result.SecretString) as Record<string, unknown>)
      : {};
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

/** Clear cache (tests / after secret rotation). */
export function clearPaymentInstructionsCache(): void {
  cachedPaymentInstructions = null;
}

export function readLogoBuffer(fileName: string): Buffer | null {
  const resolved = resolveLogo(fileName);
  if (!resolved) return null;
  return readFileSync(resolved);
}

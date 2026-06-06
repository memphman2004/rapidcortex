import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { qrReportUrl, type QRLocation } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const RC_NAVY = "#1B3A6B";
const RC_BLUE = "#2563EB";

function reportUrlForLocation(location: QRLocation): string {
  return qrReportUrl(location.rcli, env.deploymentStage);
}

export async function renderQrPng(location: QRLocation, size = 400): Promise<Buffer> {
  const url = reportUrlForLocation(location);
  return QRCode.toBuffer(url, {
    type: "png",
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: RC_NAVY, light: "#FFFFFF" },
  });
}

export async function renderQrSvg(location: QRLocation, size = 400): Promise<string> {
  const url = reportUrlForLocation(location);
  return QRCode.toString(url, {
    type: "svg",
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: RC_NAVY, light: "#FFFFFF" },
  });
}

export async function renderQrPdf(location: QRLocation): Promise<Buffer> {
  const png = await renderQrPng(location, 900);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 54 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const qrSize = 216; // ~3 inches at 72 dpi
    const qrX = doc.page.margins.left + (pageWidth - qrSize) / 2;

    doc.fontSize(10).fillColor("#64748B").text("Rapid Cortex", doc.page.margins.left, 42, {
      width: pageWidth / 2,
      align: "left",
    });
    doc.fontSize(10).text(location.orgCode, doc.page.margins.left + pageWidth / 2, 42, {
      width: pageWidth / 2,
      align: "right",
    });

    doc.image(png, qrX, 120, { width: qrSize, height: qrSize });

    doc
      .fontSize(18)
      .fillColor("#0F172A")
      .text(location.locationName, doc.page.margins.left, 360, { width: pageWidth, align: "center" });

    doc
      .fontSize(14)
      .fillColor(RC_BLUE)
      .text(`Zone ${location.zoneCode}`, doc.page.margins.left, 392, { width: pageWidth, align: "center" });

    if (location.building) {
      doc
        .fontSize(11)
        .fillColor("#475569")
        .text(location.building, doc.page.margins.left, 418, { width: pageWidth, align: "center" });
    }

    doc
      .fontSize(12)
      .fillColor("#334155")
      .text("Scan for immediate assistance", doc.page.margins.left, 460, { width: pageWidth, align: "center" });

    doc
      .fontSize(10)
      .fillColor("#64748B")
      .text(
        "Or contact your venue or campus safety team if you cannot scan.",
        doc.page.margins.left,
        488,
        { width: pageWidth, align: "center" },
      );

    doc
      .fontSize(9)
      .fillColor("#94A3B8")
      .text(location.rcli, doc.page.margins.left, doc.page.height - 72, {
        width: pageWidth,
        align: "center",
      });

    doc.end();
  });
}

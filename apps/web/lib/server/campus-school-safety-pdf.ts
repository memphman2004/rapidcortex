import "server-only";
import PDFDocument from "pdfkit";
import type { SchoolSafetyReportPdfBody } from "rapid-cortex-shared";

/**
 * K-12 School Safety period summary PDF — institutional review copy only.
 * Not a Clery Act report and not a 911 CAD record.
 */
export function generateSchoolSafetyReportPdfBuffer(
  report: SchoolSafetyReportPdfBody,
  opts?: { generatedAt?: string },
): Promise<Buffer> {
  const generatedAt = opts?.generatedAt ?? new Date().toISOString();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 50,
      info: {
        Title: `School Safety Report — ${report.schoolName}`,
        Author: "NexCort iQ",
        Subject: "K-12 school safety period summary",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const NAVY = "#0A1628";
    const T1 = "#0F172A";
    const T2 = "#334155";
    const MUTED = "#64748B";
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, doc.page.width, 68).fill(NAVY);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(15).text("NexCort iQ Campus", 50, 18);
    doc
      .font("Helvetica")
      .fontSize(9)
      .text("School Safety Report — K-12 institutional review (not a Clery Act report)", 50, 40);

    doc.fillColor(T1).font("Helvetica-Bold").fontSize(13).text(report.schoolName, 50, 88);
    doc.fillColor(T2).font("Helvetica").fontSize(10);
    if (report.districtName) doc.text(`District: ${report.districtName}`);
    if (report.gradeLevel) doc.text(`Grade level: ${report.gradeLevel}`);
    if (report.addressLine) doc.text(report.addressLine, { width: pageWidth });
    doc.text(`Campus code: ${report.campusCode}`);
    if (report.siteCode) doc.text(`School site: ${report.siteCode}`);
    doc.text(`Period: ${report.from} → ${report.to}`);
    doc.text(`Generated: ${generatedAt}`);
    if (report.preparedBy) doc.text(`Prepared by: ${report.preparedBy}`);

    doc.moveDown(0.8);
    doc.fillColor(T1).font("Helvetica-Bold").fontSize(11).text("Period summary");
    doc
      .fillColor(T2)
      .font("Helvetica")
      .fontSize(10)
      .text(`Total incidents / concerns in range: ${report.total}`);

    if (report.snapshot) {
      const parts: string[] = [];
      if (report.snapshot.activeIncidents != null) {
        parts.push(`Active now: ${report.snapshot.activeIncidents}`);
      }
      if (report.snapshot.respondersOnDuty != null) {
        parts.push(`Responders on duty: ${report.snapshot.respondersOnDuty}`);
      }
      if (report.snapshot.buildingsMonitored != null) {
        parts.push(`Buildings monitored: ${report.snapshot.buildingsMonitored}`);
      }
      if (parts.length) {
        doc.fillColor(MUTED).fontSize(9).text(`Live snapshot at generation — ${parts.join(" · ")}`);
      }
    }

    if (report.notes?.trim()) {
      doc.moveDown(0.6);
      doc.fillColor(T1).font("Helvetica-Bold").fontSize(11).text("Operator notes");
      doc.fillColor(T2).font("Helvetica").fontSize(10).text(report.notes.trim(), { width: pageWidth });
    }

    doc.moveDown(0.8);
    doc.fillColor(T1).font("Helvetica-Bold").fontSize(11).text("Counts by concern type");
    doc.moveDown(0.3);

    const colType = 50;
    const colSev = 280;
    const colEsc = 360;
    const colCount = 480;
    let y = doc.y;

    const drawHeader = () => {
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8);
      doc.text("Type", colType, y);
      doc.text("Severity", colSev, y);
      doc.text("Escalation", colEsc, y);
      doc.text("Count", colCount, y, { width: 60, align: "right" });
      y += 14;
      doc
        .strokeColor("#CBD5E1")
        .moveTo(50, y)
        .lineTo(50 + pageWidth, y)
        .stroke();
      y += 6;
    };

    drawHeader();

    let lastGroup = "";
    for (const row of report.rows) {
      if (y > doc.page.height - 72) {
        doc.addPage();
        y = 54;
        drawHeader();
        lastGroup = "";
      }
      if (row.groupLabel !== lastGroup) {
        lastGroup = row.groupLabel;
        doc.fillColor(T1).font("Helvetica-Bold").fontSize(9).text(row.groupLabel, colType, y, {
          width: pageWidth,
        });
        y += 14;
      }
      doc.fillColor(T2).font("Helvetica").fontSize(9);
      doc.text(row.typeLabel, colType + 8, y, { width: colSev - colType - 12 });
      doc.text(row.severity, colSev, y, { width: 70 });
      doc.text(row.requiresEscalation ? "Yes" : "—", colEsc, y, { width: 70 });
      doc.text(String(row.count), colCount, y, { width: 60, align: "right" });
      y += 13;
    }

    doc.y = y + 16;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Not a Clery Act Annual Security Report. Not a 911 CAD record. NexCort iQ enhances campus operations and does not replace public-safety dispatch or school policy. Counts reflect incidents recorded in the campus platform for the selected school and date range.",
        50,
        undefined,
        { width: pageWidth },
      );

    doc.end();
  });
}

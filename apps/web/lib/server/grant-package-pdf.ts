import "server-only";
import PDFDocument from "pdfkit";
import type { GrantPackage } from "rapid-cortex-shared";

export type GrantPdfProfile = {
  schoolName: string;
  city: string;
  state: string;
  grantAmount?: string;
  projectPeriod?: string;
};

/**
 * Server-side grant package PDF (Helvetica built-ins — no external font files).
 */
export function generateGrantPackagePdfBuffer(params: {
  profile: GrantPdfProfile;
  grantPackage: GrantPackage;
  generatedAt?: string;
}): Promise<Buffer> {
  const { profile, grantPackage: pkg } = params;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 54,
      info: {
        Title: `Grant package — ${profile.schoolName}`,
        Author: "Rapid Cortex",
        Subject: "Grant Success Program package",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const NAVY = "#0A1628";
    const BLUE = "#2563EB";
    const T1 = "#0F172A";
    const T2 = "#334155";
    const T3 = "#64748B";
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const generatedAt = params.generatedAt ?? new Date().toISOString().slice(0, 10);
    const total =
      pkg.totalBudget || pkg.budget.reduce((s, line) => s + (Number(line.totalCost) || 0), 0);

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    const section = (title: string, body: string) => {
      ensureSpace(80);
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(BLUE).text(title);
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(10).fillColor(T2).text(body || "—", {
        width: pageWidth,
        align: "justify",
        lineGap: 2,
      });
    };

    doc.rect(0, 0, doc.page.width, 72).fill(NAVY);
    doc
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("RAPID CORTEX", 54, 22, { continued: true })
      .font("Helvetica")
      .fontSize(11)
      .text("  ·  Grant Success Program");
    doc.fontSize(9).fillColor("#93C5FD").text("Confidential — for authorized grant submission use only", 54, 46);
    doc.y = 90;

    doc.font("Helvetica-Bold").fontSize(18).fillColor(T1).text(profile.schoolName, { width: pageWidth });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(T3)
      .text(
        `${profile.city}, ${profile.state}  ·  Generated ${generatedAt}  ·  Requested $${total.toLocaleString()}${
          profile.projectPeriod ? `  ·  ${profile.projectPeriod} months` : ""
        }`,
        { width: pageWidth },
      );

    section("1. Executive summary", pkg.executiveSummary);
    section("2. Problem statement", pkg.problemStatement);
    section("3. Project narrative", pkg.projectNarrative);
    section("4. Technology description", pkg.technologyDescription);

    ensureSpace(120);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BLUE).text("5. Budget");
    doc.moveDown(0.3);

    const col = { item: 54, cat: 280, qty: 360, unit: 400, tot: 470 };
    doc.font("Helvetica-Bold").fontSize(8).fillColor(T3);
    const headerY = doc.y;
    doc.text("ITEM", col.item, headerY, { width: 210 });
    doc.text("CATEGORY", col.cat, headerY, { width: 70 });
    doc.text("QTY", col.qty, headerY, { width: 30 });
    doc.text("UNIT", col.unit, headerY, { width: 55 });
    doc.text("TOTAL", col.tot, headerY, { width: 70 });
    doc.moveDown(0.4);
    doc.strokeColor("#E2E8F0").moveTo(54, doc.y).lineTo(558, doc.y).stroke();
    doc.moveDown(0.3);

    for (const line of pkg.budget) {
      ensureSpace(28);
      const y = doc.y;
      doc.font("Helvetica").fontSize(9).fillColor(T1).text(line.item, col.item, y, { width: 210 });
      const rowBottom = doc.y;
      doc.fontSize(8).fillColor(T2).text(line.category, col.cat, y, { width: 70 });
      doc.text(String(line.quantity ?? 1), col.qty, y, { width: 30 });
      doc.text(`$${(line.unitCost || 0).toLocaleString()}`, col.unit, y, { width: 55 });
      doc.font("Helvetica-Bold").fillColor(T1).text(`$${(line.totalCost || 0).toLocaleString()}`, col.tot, y, {
        width: 70,
      });
      doc.y = Math.max(rowBottom, y + 12);
      doc.moveDown(0.25);
    }

    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(T1).text(`Total requested: $${total.toLocaleString()}`, {
      align: "right",
      width: pageWidth,
    });

    section("6. Budget justification", pkg.budgetJustification);

    ensureSpace(100);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BLUE).text("7. Implementation timeline");
    doc.moveDown(0.3);
    for (const phase of pkg.timeline) {
      ensureSpace(40);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(T1).text(`${phase.phase} (${phase.period})`);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(T2)
        .text((phase.milestones ?? []).map((m) => `• ${m}`).join("\n"), { width: pageWidth });
      doc.moveDown(0.35);
    }

    section("8. Cybersecurity & compliance", pkg.cybersecurity);
    section("9. Sustainability plan", pkg.sustainability);
    section("10. Evaluation plan", pkg.evaluation);

    ensureSpace(100);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BLUE).text("11. Expected outcomes");
    doc.moveDown(0.3);
    for (const outcome of pkg.outcomes) {
      ensureSpace(36);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(T1).text(outcome.metric);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(T2)
        .text(`${outcome.baseline} → ${outcome.target} (${outcome.timeframe})`, { width: pageWidth });
      doc.moveDown(0.3);
    }

    doc.moveDown(1);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(T3)
      .text(
        "Rapid Cortex Grant Success Program — AI-assisted draft for authorized grant writers. Verify figures and compliance claims before submission.",
        { width: pageWidth, align: "center" },
      );

    doc.end();
  });
}

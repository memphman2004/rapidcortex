import PDFDocument from "pdfkit";
import type { CampusIncident } from "./campus-types.js";

/**
 * Campus after-action / Clery extract PDF (UM-025). Institutional review copy —
 * not a Clery determination and not a 911 CAD record.
 */
export function exportCampusAfterActionPdf(incident: CampusIncident): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 54 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const NAVY = "#0A1628";
    const T2 = "#334155";
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, doc.page.width, 64).fill(NAVY);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(16).text("Rapid Cortex Campus", 54, 22);
    doc.font("Helvetica").fontSize(9).text("After-action extract — institutional review only", 54, 42);

    doc.moveDown(3);
    doc.fillColor(T2).font("Helvetica-Bold").fontSize(14).text(`Incident ${incident.id}`);
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(10).text(`Campus: ${incident.campusCode}`);
    doc.text(`Type: ${incident.type.replace(/_/g, " ")}`);
    doc.text(`Source: ${incident.source}`);
    doc.text(`Status: ${incident.status}`);
    doc.text(`Building: ${incident.buildingLabel}${incident.roomCode ? ` · ${incident.roomCode}` : ""}`);
    doc.text(`Created: ${incident.createdAt}`);
    if (incident.assignedTo) doc.text(`Assigned: ${incident.assignedToName ?? incident.assignedTo}`);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Description");
    doc.font("Helvetica").text(incident.description || "—", { width: pageWidth });

    if (incident.eapChecklist?.steps?.length) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").text(`Checklist — ${incident.eapChecklist.title}`);
      incident.eapChecklist.steps.forEach((step, i) => {
        doc.font("Helvetica").text(`${i + 1}. ${step}`, { width: pageWidth });
      });
    }

    if (incident.cleryCategorySuggested) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").text("Clery category (suggested only)");
      doc
        .font("Helvetica")
        .text(
          `${incident.cleryCategorySuggested}. Rapid Cortex does not make Clery Act determinations. Designated Campus Security Authorities must verify before ASR inclusion.`,
          { width: pageWidth },
        );
    }

    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor("#64748B")
      .text(
        "Not a 911 CAD record. CAD write-back stays fail-closed. This extract is for campus after-action review.",
        { width: pageWidth },
      );

    doc.end();
  });
}

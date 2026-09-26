import PDFDocument from "pdfkit";
import type { EnsTestProgram, EnsTestRun } from "rapid-cortex-shared";
import { ENS_TEST_KIND_LABELS } from "rapid-cortex-shared";

export async function buildEnsTestReportPdf(params: {
  program: EnsTestProgram;
  run: EnsTestRun;
}): Promise<Buffer> {
  const { program, run } = params;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("Emergency Notification System — Test Documentation", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#333333");
    doc.text(`Institution: ${program.institutionName}`);
    doc.text(`Vertical: ${run.vertical}`);
    doc.text(`Test type: ${ENS_TEST_KIND_LABELS[run.kind]}`);
    doc.text(`Date / time (UTC): ${run.initiatedAt}`);
    if (run.completedAt) doc.text(`Completed (UTC): ${run.completedAt}`);
    doc.text(`Initiated by: ${run.actorId}${run.scheduled ? " (scheduled)" : ""}`);
    doc.moveDown();

    doc.fontSize(13).text("Scope", { underline: true });
    doc.fontSize(10).text(run.scopeDescription, { align: "left" });
    doc.moveDown();

    doc.fontSize(13).text("Channels exercised", { underline: true });
    doc.fontSize(10).text(run.channels.join(", "));
    doc.moveDown();

    doc.fontSize(13).text("Delivery results", { underline: true });
    for (const row of run.channelSummary) {
      doc
        .fontSize(10)
        .text(
          `${row.channel}: queued=${row.queued} sent=${row.sent} delivered=${row.delivered} failed=${row.failed} skipped=${row.skipped}${
            row.skipReason ? ` (${row.skipReason})` : ""
          }`,
        );
    }
    doc.moveDown();

    doc.fontSize(13).text("Failures / exceptions", { underline: true });
    if (run.failures.length === 0) {
      doc.fontSize(10).text("None recorded.");
    } else {
      for (const f of run.failures) doc.fontSize(10).text(`• ${f}`);
    }
    doc.moveDown();

    doc.fontSize(9).fillColor("#666666");
    doc.text(
      "This report supports Clery Act and institutional ENS test record-keeping (monthly silent, semester audible, and annual comprehensive tests). Retain with your Clery compliance files.",
    );

    doc.end();
  });
}

/**
 * Builds HTML + plain-text invoice email bodies.
 * Pure string functions — no AWS SDK, no DOM.
 *
 * Payment copy matches MSA terms. Bank account numbers are never inlined;
 * routing/SWIFT are public MSA identifiers.
 */

import type { AutomatedInvoice } from "./invoice-types.js";

const SUPPORT_EMAIL = "billing@nexcortiq.us";

export function buildInvoiceEmailSubject(invoice: AutomatedInvoice): string {
  const period = formatPeriod(invoice.billingPeriod);
  const amount = formatDollars(invoice.totalCents);
  return `NexCort iQ Invoice ${invoice.invoiceId} — ${period} — ${amount} due ${formatDate(invoice.dueDate)}`;
}

export function buildInvoiceEmailHtml(invoice: AutomatedInvoice): string {
  const period = formatPeriod(invoice.billingPeriod);
  const isOverdue = invoice.status === "overdue";

  const linesHtml = invoice.lines
    .filter((l) => l.amountCents !== 0)
    .map(
      (line) => `
      <tr style="border-bottom:1px solid #f1f3f5;">
        <td style="padding:10px 0;font-size:13px;color:${line.amountCents < 0 ? "#16a34a" : "#1f2937"}">${escapeHtml(line.description)}</td>
        <td style="padding:10px 0;font-size:13px;color:#6b7280;text-align:center;">${line.quantity > 1 ? `${line.quantity} × ${formatDollars(line.unitPriceCents)}` : ""}</td>
        <td style="padding:10px 0;font-size:13px;font-weight:600;text-align:right;color:${line.amountCents < 0 ? "#16a34a" : "#1f2937"}">${line.amountCents < 0 ? `(${formatDollars(Math.abs(line.amountCents))})` : formatDollars(line.amountCents)}</td>
      </tr>
    `,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div style="max-width:700px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">

  <div style="background:#0f172a;padding:28px 36px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="color:#94a3b8;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">NexCort iQ</div>
      <div style="color:#fff;font-size:22px;font-weight:700;">Invoice</div>
    </div>
    ${isOverdue ? `<div style="background:#dc2626;color:#fff;padding:6px 16px;border-radius:6px;font-size:13px;font-weight:700;">OVERDUE</div>` : ""}
  </div>

  <div style="background:#f8fafc;padding:20px 36px;display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;gap:12px;">
    <div>
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Invoice</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(invoice.invoiceId)}</div>
    </div>
    <div>
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Billing Period</div>
      <div style="font-size:15px;font-weight:600;color:#1e293b;">${period}</div>
    </div>
    <div>
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Invoice Date</div>
      <div style="font-size:15px;font-weight:600;color:#1e293b;">${formatDate(invoice.invoiceDate)}</div>
    </div>
    <div>
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Due Date</div>
      <div style="font-size:15px;font-weight:700;color:${isOverdue ? "#dc2626" : "#0f172a"};">NET 30 — ${formatDate(invoice.dueDate)}</div>
    </div>
  </div>

  <div style="padding:24px 36px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;border-bottom:1px solid #e2e8f0;">
    <div>
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">Bill To</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(invoice.agencyName)}</div>
      <div style="font-size:13px;color:#475569;">${escapeHtml(invoice.billingContactName)}</div>
      <div style="font-size:13px;color:#475569;">${escapeHtml(invoice.billingContactEmail)}</div>
      ${invoice.poNumber ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px;">PO #${escapeHtml(invoice.poNumber)}</div>` : ""}
    </div>
    <div>
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">From</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a;">Apps on Demand LLC</div>
      <div style="font-size:13px;color:#475569;">d/b/a NexCort iQ</div>
      <div style="font-size:13px;color:#475569;">${SUPPORT_EMAIL}</div>
    </div>
  </div>

  <div style="padding:16px 36px;background:#f0f9ff;border-bottom:1px solid #e0f2fe;">
    <span style="font-size:13px;color:#0369a1;font-weight:600;">${escapeHtml(invoice.planLabel)} Plan — ${escapeHtml(invoice.tierLabel)}</span>
    ${invoice.proRated ? `<span style="margin-left:12px;font-size:12px;color:#0369a1;">(Pro-rated ${invoice.proRationDays} days)</span>` : ""}
  </div>

  <div style="padding:24px 36px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid #e2e8f0;">
          <th style="text-align:left;padding-bottom:10px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">Description</th>
          <th style="text-align:center;padding-bottom:10px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:180px;">Qty / Unit</th>
          <th style="text-align:right;padding-bottom:10px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:120px;">Amount</th>
        </tr>
      </thead>
      <tbody>${linesHtml}</tbody>
    </table>
  </div>

  <div style="padding:16px 36px 24px;border-top:2px solid #e2e8f0;">
    <div style="display:flex;justify-content:flex-end;">
      <table style="min-width:280px;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#64748b;">Subtotal</td>
          <td style="padding:6px 0;font-size:14px;color:#1e293b;text-align:right;padding-left:40px;">${formatDollars(invoice.subtotalCents)}</td>
        </tr>
        ${
          invoice.discountCents > 0
            ? `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#16a34a;">Discounts</td>
          <td style="padding:6px 0;font-size:14px;color:#16a34a;text-align:right;padding-left:40px;">(${formatDollars(invoice.discountCents)})</td>
        </tr>`
            : ""
        }
        <tr style="border-top:2px solid #0f172a;">
          <td style="padding:14px 0 6px;font-size:18px;font-weight:700;color:#0f172a;">Total Due</td>
          <td style="padding:14px 0 6px;font-size:18px;font-weight:700;color:#0f172a;text-align:right;padding-left:40px;">${formatDollars(invoice.totalCents)}</td>
        </tr>
      </table>
    </div>
  </div>

  <div style="background:#f8fafc;padding:24px 36px;border-top:1px solid #e2e8f0;">
    <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:12px;">Payment Instructions</div>
    <div style="font-size:13px;color:#475569;line-height:1.8;">
      <strong>Payment due: NET 30 — ${formatDate(invoice.dueDate)}</strong><br>
      Accepted methods: ACH transfer, wire transfer, or check<br><br>
      <strong>ACH Transfer</strong><br>
      Bank: Navy Federal Credit Union<br>
      Routing: 256074974<br>
      Account name: Apps on Demand LLC<br>
      Account number: <em>(provided separately upon request)</em><br><br>
      <strong>Wire Transfer</strong><br>
      SWIFT/BIC: NFCUUS33<br>
      Account name: Apps on Demand LLC<br><br>
      <strong>Check</strong><br>
      Payable to: Apps on Demand LLC<br>
      Address: <em>(provided separately)</em><br><br>
      Late payments accrue interest at 1.5% per month (18% APR). Services may be suspended after 60 days overdue.
    </div>
  </div>

  <div style="padding:16px 36px;text-align:center;border-top:1px solid #e2e8f0;">
    <div style="font-size:12px;color:#94a3b8;">Questions? Contact ${SUPPORT_EMAIL}</div>
    <div style="font-size:11px;color:#cbd5e1;margin-top:6px;">NexCort iQ — Intelligence at the speed of response · Invoice ${escapeHtml(invoice.invoiceId)}</div>
  </div>

</div>
</body></html>`;
}

export function buildInvoiceEmailText(invoice: AutomatedInvoice): string {
  const period = formatPeriod(invoice.billingPeriod);
  const lines = invoice.lines
    .filter((l) => l.amountCents !== 0)
    .map((l) => `  ${l.description.padEnd(55)} ${formatDollars(l.amountCents).padStart(12)}`)
    .join("\n");

  return `NEXCORT IQ — INVOICE ${invoice.invoiceId}
${"=".repeat(60)}
Billing Period: ${period}
Invoice Date:   ${formatDate(invoice.invoiceDate)}
Due Date:       NET 30 — ${formatDate(invoice.dueDate)}

Bill To: ${invoice.agencyName}
         ${invoice.billingContactName}
         ${invoice.billingContactEmail}
${invoice.poNumber ? `PO Number: ${invoice.poNumber}\n` : ""}
Plan: ${invoice.planLabel} — ${invoice.tierLabel}
${invoice.proRated ? `(Pro-rated: ${invoice.proRationDays} days)\n` : ""}
LINE ITEMS
${"─".repeat(60)}
${lines}
${"─".repeat(60)}
  Subtotal                                          ${formatDollars(invoice.subtotalCents).padStart(12)}
${invoice.discountCents > 0 ? `  Discounts                                        (${formatDollars(invoice.discountCents).padStart(10)})\n` : ""}  TOTAL DUE                                         ${formatDollars(invoice.totalCents).padStart(12)}
${"=".repeat(60)}

PAYMENT INSTRUCTIONS
Payment due: NET 30 — ${formatDate(invoice.dueDate)}

ACH: Navy Federal Credit Union · Routing 256074974
     Account name: Apps on Demand LLC

Wire: SWIFT NFCUUS33 · Account name: Apps on Demand LLC

Check payable to: Apps on Demand LLC

Late payment: 1.5%/month (18% APR). Suspension after 60 days overdue.

Questions: ${SUPPORT_EMAIL}
Invoice ${invoice.invoiceId} · NexCort iQ — Intelligence at the speed of response`;
}

export function formatInvoiceDollars(cents: number): string {
  return formatDollars(cents);
}

function formatDollars(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

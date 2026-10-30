export type IQReportSnapshot = {
  title: string;
  rangeLabel: string;
  generatedAt: string;
  publicSafe: boolean;
  kpis: { label: string; value: string; trend?: string }[];
  lineChartLabel: string;
  hourly: { hour: number; value: number }[];
  breakdownTitle: string;
  breakdown: { name: string; value: number }[];
};

export function reportLines(snapshot: IQReportSnapshot): string[] {
  const lines = [
    snapshot.title,
    `Range: ${snapshot.rangeLabel}`,
    `Generated: ${snapshot.generatedAt}`,
    snapshot.publicSafe
      ? "Public-safe: internal QA, Clery, MCI, staff-safety, and operator-incident metrics are hidden."
      : "Includes internal metrics.",
    "",
    "Metrics",
  ];
  for (const kpi of snapshot.kpis) {
    lines.push(`${kpi.label}: ${kpi.value}${kpi.trend ? ` (${kpi.trend} vs prior)` : ""}`);
  }
  lines.push("", snapshot.lineChartLabel);
  const activeHours = snapshot.hourly.filter((point) => point.value > 0);
  if (activeHours.length === 0) {
    lines.push("No hourly volume in this range.");
  } else {
    for (const point of activeHours) {
      lines.push(`${String(point.hour).padStart(2, "0")}:00  ${point.value}`);
    }
  }
  lines.push("", snapshot.breakdownTitle);
  if (snapshot.breakdown.length === 0) lines.push("No breakdown metrics in this range.");
  for (const row of snapshot.breakdown) {
    lines.push(`${row.name}: ${row.value}`);
  }
  lines.push("", "NexCort iQ reporting. Not a dispatcher workspace.");
  return lines;
}

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Single-page text PDF. Helvetica only, so the file stays valid without embedded fonts. */
export function buildReportPdf(snapshot: IQReportSnapshot): Blob {
  const content = reportLines(snapshot)
    .slice(0, 42)
    .map((line, index) => {
      const y = 760 - index * 16;
      return `BT /F1 11 Tf 1 0 0 1 48 ${y} Tm (${pdfEscape(line).slice(0, 95)}) Tj ET`;
    })
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 3 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new Blob([body], { type: "application/pdf" });
}

export function buildReportIcs(snapshot: IQReportSnapshot, attendeeEmail: string): string {
  const stamp = snapshot.generatedAt.replace(/[-:]/g, "").replace(/\.\d+/, "");
  const start = new Date();
  start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
  start.setHours(13, 0, 0, 0);
  const dt = start.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const description = reportLines(snapshot)
    .join("\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NexCort iQ//iQ reporting//EN",
    "BEGIN:VEVENT",
    `UID:iq-report-${dt}@nexcortiq.us`,
    `DTSTAMP:${stamp.endsWith("Z") ? stamp : `${stamp}Z`}`,
    `DTSTART:${dt}`,
    "RRULE:FREQ=WEEKLY",
    `SUMMARY:${snapshot.title}`,
    `DESCRIPTION:${description}`,
    `ATTENDEE:mailto:${attendeeEmail}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function renderReportPng(snapshot: IQReportSnapshot): Blob | null {
  const canvas = document.createElement("canvas");
  const width = 1100;
  const height = 720;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#100e1a";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#e4dff5";
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillText(snapshot.title, 36, 52);
  ctx.fillStyle = "#5a4d7a";
  ctx.font = "16px Inter, sans-serif";
  ctx.fillText(`${snapshot.rangeLabel} · ${snapshot.generatedAt}`, 36, 80);

  snapshot.kpis.slice(0, 6).forEach((kpi, index) => {
    const x = 36 + (index % 3) * 340;
    const y = 110 + Math.floor(index / 3) * 90;
    ctx.fillStyle = "#1a1630";
    ctx.fillRect(x, y, 320, 76);
    ctx.fillStyle = "#5a4d7a";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(kpi.label, x + 16, y + 28);
    ctx.fillStyle = "#e4dff5";
    ctx.font = "600 24px Inter, sans-serif";
    ctx.fillText(kpi.value, x + 16, y + 58);
  });

  const chartTop = 310;
  const chartHeight = 180;
  const max = Math.max(1, ...snapshot.hourly.map((point) => point.value));
  ctx.fillStyle = "#1a1630";
  ctx.fillRect(36, chartTop, 640, 250);
  ctx.fillStyle = "#5a4d7a";
  ctx.font = "14px Inter, sans-serif";
  ctx.fillText(snapshot.lineChartLabel, 52, chartTop + 28);
  snapshot.hourly.forEach((point, index) => {
    const barHeight = (point.value / max) * chartHeight;
    ctx.fillStyle = "#2a78d6";
    ctx.fillRect(56 + index * 25, chartTop + 220 - barHeight, 16, barHeight);
  });

  ctx.fillStyle = "#1a1630";
  ctx.fillRect(700, chartTop, 364, 250);
  ctx.fillStyle = "#5a4d7a";
  ctx.fillText(snapshot.breakdownTitle, 716, chartTop + 28);
  ctx.fillStyle = "#e4dff5";
  ctx.font = "15px Inter, sans-serif";
  const rows = snapshot.breakdown.length ? snapshot.breakdown : [{ name: "No breakdown metrics", value: 0 }];
  rows.slice(0, 8).forEach((row, index) => {
    const label = snapshot.breakdown.length ? `${row.name}: ${row.value}` : row.name;
    ctx.fillText(label.slice(0, 36), 716, chartTop + 60 + index * 22);
  });

  const binary = atob(canvas.toDataURL("image/png").split(",")[1] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

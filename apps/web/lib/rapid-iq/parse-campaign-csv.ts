import { RAPID_IQ_SALES_BULK_MAX_RECIPIENTS } from "rapid-cortex-shared";

export type CampaignCsvRow = {
  email: string;
  agencyName: string;
  recipientName?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  return line.split(",").map((c) => c.trim());
}

function headerIndex(cells: string[]): { email: number; agency: number; name: number } | null {
  const lower = cells.map((c) => c.toLowerCase().replace(/[_\s-]/g, ""));
  const email = lower.findIndex((c) => c === "email" || c === "e-mail" || c === "mailto");
  const agency = lower.findIndex(
    (c) => c === "agency" || c === "agencyname" || c === "organization" || c === "org",
  );
  const name = lower.findIndex(
    (c) => c === "name" || c === "recipientname" || c === "contact" || c === "firstname",
  );
  if (email < 0 || agency < 0) return null;
  return { email, agency, name };
}

export function parseCampaignCsv(text: string): {
  rows: CampaignCsvRow[];
  errors: string[];
  truncated: boolean;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  const errors: string[] = [];
  const rows: CampaignCsvRow[] = [];
  if (lines.length === 0) return { rows, errors, truncated: false };

  const first = splitLine(lines[0]!);
  const indexed = headerIndex(first);
  const start = indexed ? 1 : 0;
  const cols = indexed ?? { email: 0, agency: 1, name: 2 };

  for (let i = start; i < lines.length; i += 1) {
    if (rows.length >= RAPID_IQ_SALES_BULK_MAX_RECIPIENTS) {
      return { rows, errors, truncated: true };
    }
    const cells = splitLine(lines[i]!);
    const email = (cells[cols.email] ?? "").trim().toLowerCase();
    const agencyName = (cells[cols.agency] ?? "").trim();
    const recipientName = (cols.name >= 0 ? cells[cols.name] : "")?.trim();
    if (!EMAIL_RE.test(email)) {
      errors.push(`Line ${i + 1}: invalid email`);
      continue;
    }
    if (!agencyName) {
      errors.push(`Line ${i + 1}: agency name required`);
      continue;
    }
    rows.push({
      email,
      agencyName,
      recipientName: recipientName || undefined,
    });
  }
  return { rows, errors, truncated: false };
}

import { NextResponse } from "next/server";

type CspReportBody = {
  "csp-report"?: Record<string, unknown>;
  "document-uri"?: string;
  "violated-directive"?: string;
  "blocked-uri"?: string;
  [key: string]: unknown;
};

/**
 * CSP report ingestion endpoint used during report-only rollout.
 * Keep payload logging minimal and structured to avoid collecting sensitive data.
 */
export async function POST(request: Request) {
  let payload: CspReportBody | null = null;
  try {
    payload = (await request.json()) as CspReportBody;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const report = payload?.["csp-report"] ?? payload ?? {};
  const entry = {
    type: "security.csp_violation",
    documentUri: String(report["document-uri"] ?? ""),
    violatedDirective: String(report["violated-directive"] ?? report["effective-directive"] ?? ""),
    blockedUri: String(report["blocked-uri"] ?? ""),
    sourceFile: String(report["source-file"] ?? ""),
  };
  console.warn(JSON.stringify(entry));
  return new NextResponse(null, { status: 204 });
}

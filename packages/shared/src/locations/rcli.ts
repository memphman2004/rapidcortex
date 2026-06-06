const RCLI_REGEX = /^RCLI-([A-Z0-9]{2,8})-(\d{6})$/;

export type QrReportStage = "dev" | "staging" | "prod";

export function generateRCLI(orgCode: string, sequence: number): string {
  const code = orgCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const seq = String(sequence).padStart(6, "0");
  return `RCLI-${code}-${seq}`;
}

export function parseRCLI(rcli: string): { orgCode: string; sequence: number } | null {
  const match = RCLI_REGEX.exec(rcli.trim().toUpperCase());
  if (!match) return null;
  return { orgCode: match[1]!, sequence: parseInt(match[2]!, 10) };
}

export function isValidRCLI(rcli: string): boolean {
  return RCLI_REGEX.test(rcli.trim().toUpperCase());
}

function readEnv(name: string, fallback: string): string {
  if (typeof process !== "undefined" && process.env?.[name]?.trim()) {
    return process.env[name]!.trim().replace(/\/$/, "");
  }
  return fallback;
}

export function reportBaseUrlForStage(stage: string): string {
  switch (stage) {
    case "prod":
    case "pilot":
      return readEnv("NEXT_PUBLIC_REPORT_ORIGIN", "https://report.rapidcortex.us");
    case "staging":
      return readEnv("NEXT_PUBLIC_REPORT_ORIGIN_STAGING", "https://staging.report.rapidcortex.us");
    default:
      return readEnv("NEXT_PUBLIC_REPORT_ORIGIN_DEV", "https://dev.report.rapidcortex.us");
  }
}

export function qrReportUrl(rcli: string, stage: QrReportStage | string = "prod"): string {
  const base = reportBaseUrlForStage(stage);
  return `${base}/r/${encodeURIComponent(rcli.trim().toUpperCase())}`;
}

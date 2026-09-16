export type SelfServiceReportDto = {
  agencyId?: string;
  sessionId?: string;
  portalUrl?: string;
  status?: string;
  caseNumber?: string;
  error?: string;
};

/** SMS tokens are 48-char hex; reject obviously truncated links before calling the API. */
export const SELF_SERVICE_TOKEN_MIN_LENGTH = 16;

export function decodeSelfServiceToken(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value;
  }
}

export function isSelfServiceTokenShape(token: string): boolean {
  return token.length >= SELF_SERVICE_TOKEN_MIN_LENGTH && token.length <= 128;
}

export function selfServiceStatusLabel(status: string | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "SENT":
      return "Link sent";
    case "CLICKED":
      return "Opened";
    case "COMPLETED":
      return "Marked complete";
    case "FAILED":
    case "DECLINED":
      return "Not completed";
    case "OFFERED":
    case "ELIGIBLE":
      return "Ready";
    default:
      return status?.trim() || "Ready";
  }
}

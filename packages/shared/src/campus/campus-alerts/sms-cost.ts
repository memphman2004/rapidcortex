/**
 * SMS segment estimation for Campus Alerts emergency previews.
 * Labels results as estimates — not carrier invoices.
 */

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

function isGsm7(message: string): boolean {
  for (const ch of message) {
    if (!GSM7_BASIC.includes(ch) && ch !== "\n" && ch !== "\r") {
      // Common GSM7 extensions (escaped) — count as UCS-2 for conservative estimate.
      if (!"^{}\\[~]|€".includes(ch)) return false;
    }
  }
  return true;
}

export function estimateSmsSegments(messageBody: string): {
  encoding: "gsm7" | "ucs2";
  segmentsPerMessage: number;
} {
  const encoding = isGsm7(messageBody) ? "gsm7" : "ucs2";
  const len = [...messageBody].length;
  if (encoding === "gsm7") {
    if (len <= 160) return { encoding, segmentsPerMessage: 1 };
    return { encoding, segmentsPerMessage: Math.ceil(len / 153) };
  }
  if (len <= 70) return { encoding, segmentsPerMessage: 1 };
  return { encoding, segmentsPerMessage: Math.ceil(len / 67) };
}

export function estimateEmergencyBroadcastCost(opts: {
  messageBody: string;
  recipientCount: number;
  ratePerSegmentUsd: number;
}): {
  encoding: "gsm7" | "ucs2";
  segmentsPerMessage: number;
  estimatedSegments: number;
  estimatedTotalCostUsd: number;
} {
  const { encoding, segmentsPerMessage } = estimateSmsSegments(opts.messageBody);
  const estimatedSegments = opts.recipientCount * segmentsPerMessage;
  const estimatedTotalCostUsd =
    Math.round(estimatedSegments * Math.max(0, opts.ratePerSegmentUsd) * 100) / 100;
  return { encoding, segmentsPerMessage, estimatedSegments, estimatedTotalCostUsd };
}

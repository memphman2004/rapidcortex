import QRCode from "qrcode";
import type { ReportVertical } from "rapid-cortex-shared";

interface GenerateQROptions {
  url: string;
  size?: number;
  errorLevel?: "L" | "M" | "Q" | "H";
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

export async function generateQRCodeBase64(options: GenerateQROptions): Promise<string> {
  const {
    url,
    size = 400,
    errorLevel = "M",
    margin = 2,
    darkColor = "#000000",
    lightColor = "#FFFFFF",
  } = options;

  return QRCode.toDataURL(url, {
    width: size,
    errorCorrectionLevel: errorLevel,
    margin,
    color: { dark: darkColor, light: lightColor },
  });
}

export function qrColorsForVertical(vertical: ReportVertical | string): {
  darkColor: string;
  lightColor: string;
} {
  const colors: Record<string, { darkColor: string; lightColor: string }> = {
    campus: { darkColor: "#064E3B", lightColor: "#ECFDF5" },
    venue: { darkColor: "#78350F", lightColor: "#FFFBEB" },
    hospital: { darkColor: "#7F1D1D", lightColor: "#FEF2F2" },
    transit: { darkColor: "#312E81", lightColor: "#EEF2FF" },
    "911": { darkColor: "#1E3A8A", lightColor: "#EFF6FF" },
  };
  return colors[vertical] ?? { darkColor: "#000000", lightColor: "#FFFFFF" };
}

export function qrNfcReportUrl(qrId: string, baseUrl: string, medium?: "qr" | "nfc"): string {
  const base = baseUrl.replace(/\/$/, "");
  const url = `${base}/report/${encodeURIComponent(qrId)}`;
  if (medium) return `${url}?medium=${medium}`;
  return url;
}

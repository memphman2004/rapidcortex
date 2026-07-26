import type { ReactNode } from "react";

/**
 * Report routes own their chrome:
 * - QR/NFC intake (`QRNfcIntakeClient`) renders SafetyHeader + sticky footer
 * - Legacy venue wizard wraps itself via `LegacyReportShell`
 */
export default function ReportLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

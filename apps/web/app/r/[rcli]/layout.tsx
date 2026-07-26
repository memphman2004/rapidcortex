import type { ReactNode } from "react";

/**
 * QR/NFC public intake owns its full-bleed chrome (header, footer, theme).
 * Do not wrap with a second sticky 911 footer here.
 */
export default function QRIntakeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

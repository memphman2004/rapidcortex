import type { Metadata } from "next";
import { JurisdictionProvider } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Canonical sign-in at `/login` uses the deployment default jurisdiction for
 * post-login links (`NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG`).
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <JurisdictionProvider slug={defaultJurisdictionSlug()}>{children}</JurisdictionProvider>
  );
}

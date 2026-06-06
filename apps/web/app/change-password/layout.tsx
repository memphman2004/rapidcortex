import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JurisdictionProvider } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

/**
 * Matches `/login` shell: Query + session + default jurisdiction context for redirects after update.
 */
export default function ChangePasswordLayout({ children }: { children: ReactNode }) {
  return (
    <JurisdictionProvider slug={defaultJurisdictionSlug()}>{children}</JurisdictionProvider>
  );
}

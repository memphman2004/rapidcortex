import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPublicPageMetadata } from "@/lib/seo";
import { ContactSalesMarketingPage } from "./contact-sales-marketing-page";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Contact Support | Rapid Cortex Public Safety Intelligence Platform",
  description:
    "Talk with Rapid Cortex about Venue, Campus, 911 dispatch intelligence pilots, PSAP software deployment, CAD-friendly integration, procurement-ready quotes, and emergency communications operations.",
  path: "/contact-sales",
});

export default function MarketingContactSalesPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
      <ContactSalesMarketingPage />
    </Suspense>
  );
}

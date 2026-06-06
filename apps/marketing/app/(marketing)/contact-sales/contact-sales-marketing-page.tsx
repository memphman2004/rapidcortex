"use client";

import { useSearchParams } from "next/navigation";
import { ContactSalesPageBody } from "@/components/marketing/contact-sales/contact-sales-page-body";

export function ContactSalesMarketingPage() {
  const searchParams = useSearchParams();
  const interestFromSearch = searchParams.get("interest");

  return <ContactSalesPageBody interestFromSearch={interestFromSearch} />;
}

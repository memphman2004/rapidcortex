import Link from "next/link";
import type { ReactNode } from "react";
import { marketingDemoRequestPath } from "@/lib/marketing-links";

type MarketingBookAppointmentLinkProps = {
  children: ReactNode;
  className?: string;
  /** Passed to `?interest=` on the contact-sales form. */
  interest?: string;
};

/** Routes to the contact-sales form — Calendly is sent manually after review. */
export function MarketingBookAppointmentLink({
  children,
  className,
  interest = "demo",
}: MarketingBookAppointmentLinkProps) {
  return (
    <Link href={marketingDemoRequestPath(interest)} className={className}>
      {children}
    </Link>
  );
}

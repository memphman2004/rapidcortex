import Link from "next/link";
import type { ReactNode } from "react";
import { marketingBookAppointmentUrl } from "@/lib/marketing-links";

type MarketingBookAppointmentLinkProps = {
  children: ReactNode;
  className?: string;
};

/** Same-origin link to the contact-sales intake form. */
export function MarketingBookAppointmentLink({
  children,
  className,
}: MarketingBookAppointmentLinkProps) {
  return (
    <Link href={marketingBookAppointmentUrl()} className={className} prefetch={false}>
      {children}
    </Link>
  );
}

import type { ReactNode } from "react";
import { marketingBookAppointmentUrl } from "@/lib/marketing-links";

type MarketingBookAppointmentLinkProps = {
  children: ReactNode;
  className?: string;
};

/** Opens Microsoft Bookings in a new tab. */
export function MarketingBookAppointmentLink({
  children,
  className,
}: MarketingBookAppointmentLinkProps) {
  return (
    <a
      href={marketingBookAppointmentUrl()}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

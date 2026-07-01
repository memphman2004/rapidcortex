import { VerticalDisclaimerBanner } from "@/components/vertical/vertical-disclaimer-banner";
import { VENUE_GUEST_SERVICES_DISCLAIMER } from "@/lib/venue/venue-guest-services";

/** Single canonical disclaimer for all venue guest-services surfaces. */
export function VenueGuestServicesDisclaimer({ className }: { className?: string }) {
  return (
    <div className={className}>
      <VerticalDisclaimerBanner message={VENUE_GUEST_SERVICES_DISCLAIMER} />
    </div>
  );
}

/** Scopes `globals.css` vertical accents (indigo) for all `/app/transit/*` routes. */
import { VerticalAlertOverlay } from "@/components/alerts/vertical-alert-overlay";

export default function TransitAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-vertical="transit">
      <VerticalAlertOverlay />
      {children}
    </div>
  );
}

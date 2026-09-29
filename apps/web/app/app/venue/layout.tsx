/** Scopes `globals.css` vertical accents (orange) for all `/app/venue/*` routes. */
import { VenuePwaBootstrap } from "@/components/venue/venue-pwa-bootstrap";

export default function VenueAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-vertical="venue">
      <VenuePwaBootstrap />
      {children}
    </div>
  );
}

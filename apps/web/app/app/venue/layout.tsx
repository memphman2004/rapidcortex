/** Scopes `globals.css` vertical accents (orange) for all `/app/venue/*` routes. */
export default function VenueAppLayout({ children }: { children: React.ReactNode }) {
  return <div data-vertical="venue">{children}</div>;
}

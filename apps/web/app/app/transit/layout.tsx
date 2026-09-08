/** Scopes `globals.css` vertical accents (indigo) for all `/app/transit/*` routes. */
export default function TransitAppLayout({ children }: { children: React.ReactNode }) {
  return <div data-vertical="transit">{children}</div>;
}

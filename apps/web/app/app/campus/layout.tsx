/** Scopes `globals.css` vertical accents (slate) for all `/app/campus/*` routes. */
export default function CampusAppLayout({ children }: { children: React.ReactNode }) {
  return <div data-vertical="campus">{children}</div>;
}

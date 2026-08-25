"use client";

import Link from "next/link";

const RELATED = [
  { href: "/venue-safety-software", label: "Venue safety software" },
  { href: "/stadium-security-software", label: "Stadium security software" },
  { href: "/venue-safety-integrations", label: "Venue safety integrations" },
  { href: "/venue", label: "Venue safety intelligence" },
  { href: "/integrations", label: "Integrations overview" },
  { href: "/free-60-day-pilot", label: "Free 60-Day Pilot" },
] as const;

/** Below-fold related links on /product/venue — loaded via `next/dynamic` from the page. */
export function VenueRelatedResources() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="venue-related-heading">
      <h2 id="venue-related-heading" className="text-lg font-semibold text-white">
        Related venue resources
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RELATED.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-900/70"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

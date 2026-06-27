import Link from "next/link";
import { footerNav, isFooterLinkGroup } from "@/lib/site/footer-nav";

/**
 * Reference implementation only — your real Footer almost certainly already
 * has its own layout, columns, and styling. Pull the `footerNav` data and
 * the structure below into that file rather than rendering this directly.
 *
 * Note: "Solutions" renders as a static label + 3 links, not a hover/click
 * dropdown. Footers are scanned, not navigated interactively — an always-
 * visible group reads faster and needs no extra keyboard/touch handling.
 */
export function FooterNavColumns() {
  return (
    <nav aria-label="Footer" className="flex flex-wrap gap-10 text-sm">
      {footerNav.map((item) =>
        isFooterLinkGroup(item) ? (
          <div key={item.label}>
            <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              {item.label}
            </p>
            <ul className="mt-3 space-y-2">
              {item.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-slate-400 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className="text-slate-400 transition-colors hover:text-white"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

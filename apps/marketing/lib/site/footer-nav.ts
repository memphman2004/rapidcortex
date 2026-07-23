export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterLinkGroup {
  label: string;
  links: FooterLink[];
}

export type FooterNavItem = FooterLink | FooterLinkGroup;

export function isFooterLinkGroup(item: FooterNavItem): item is FooterLinkGroup {
  return "links" in item;
}

/** Canonical marketing routes (apps/marketing/app/(marketing)/…). */
export const footerNav: FooterNavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Solutions",
    links: [
      { label: "Rapid Cortex Core", href: "/product/core" },
      { label: "Rapid Cortex Venue", href: "/product/venue" },
      { label: "Rapid Cortex Campus", href: "/product/campus" },
    ],
  },
  { label: "About", href: "/about" },
  { label: "Contact", href: "https://www.rapidcortex.us/contact-sales?interest=demo" },
  { label: "Insights & Resources", href: "/blog" },
];

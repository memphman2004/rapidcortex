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
      { label: "911 Centers/PSAPs", href: "/product/core" },
      { label: "NexCort iQ Venue", href: "/product/venue" },
      { label: "NexCort iQ Campus", href: "/product/campus" },
      { label: "Grant Success Program", href: "/grants" },
      { label: "Campus safety software", href: "/campus-safety-software" },
      { label: "Venue safety software", href: "/venue-safety-software" },
      { label: "Integrations", href: "/integrations" },
    ],
  },
  { label: "About", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "https://www.rapidcortex.us/contact-sales?interest=demo" },
  { label: "Insights & Resources", href: "/blog" },
  {
    label: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of use", href: "/terms" },
      { label: "Account deletion", href: "/account-deletion" },
      { label: "Sub-processors", href: "/legal/sub-processors" },
    ],
  },
];

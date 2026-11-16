"use client";

import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { SiteLogoMark } from "@/components/brand/site-logo-link";
import { MARKETING_EVENTS, trackMarketingEvent } from "@/lib/marketing-site-analytics";
import {
  marketingBookAppointmentUrl,
  marketingContactPath,
  marketingDemoRequestPath,
  marketingHomePath,
  marketingLoginPath,
  marketingPricingPath,
  marketingGrantsPath,
} from "@/lib/marketing-links";

const DRAWER_TITLE = "NexCort iQ";
const DRAWER_SLOGAN = "Intelligence at the speed of response.";
const MOBILE_BOOKING_NOTE =
  "Request a demo — tell us about your agency and we’ll follow up to schedule a walkthrough.";

type NavLink = { label: string; href: string };
type NavGroup = { label: string; items: readonly NavLink[] };

const SOLUTIONS: NavGroup = {
  label: "Solutions",
  items: [
    { label: "911 & Dispatch", href: "/product/core" },
    { label: "NEXiQ", href: "/nexiq" },
    { label: "Campus Safety", href: "/product/campus" },
    { label: "iQ Vision", href: "/iq-vision" },
    { label: "Venue Safety", href: "/product/venue" },
    { label: "Transit Safety", href: "/product/transit" },
  ],
};

const PLATFORM: NavGroup = {
  label: "Platform",
  items: [
    { label: "How It Works", href: "/product" },
    { label: "Security & Compliance", href: "/security" },
    { label: "CAD Integration", href: "/cad-integration" },
    { label: "Implementation", href: "/free-60-day-pilot" },
  ],
};

const RESOURCES: NavGroup = {
  label: "Resources",
  items: [
    { label: "Blog", href: "/blog" },
    { label: "Grants", href: marketingGrantsPath() },
    { label: "Developer Docs", href: "/developers/docs" },
    { label: "NexCortiQ Signal", href: "/newsletter" },
  ],
};

const ABOUT: NavGroup = {
  label: "About",
  items: [
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Press", href: "/press" },
    { label: "Contact", href: marketingContactPath() },
  ],
};

const DROPDOWN_GROUPS = [SOLUTIONS, PLATFORM, RESOURCES, ABOUT] as const;

/** Primary marketing nav — product depth links live in the footer. */
export function getMarketingMobileDrawerLinkDefs(): readonly { label: string; href: string }[] {
  return [
    ...SOLUTIONS.items,
    ...PLATFORM.items,
    { label: "Integrations", href: "/integrations" },
    { label: "Pricing", href: marketingPricingPath() },
    ...RESOURCES.items,
    ...ABOUT.items,
  ];
}

/** True if `href` is an operational/auth entry excluded from mobile marketing surfaces. */
export function isOperationalAuthHref(href: string): boolean {
  if (href === "/login" || href === "/signin" || href === "/signup") return true;
  if (href.startsWith("/auth")) return true;
  const keywords = [
    "dashboard",
    "dispatcher",
    "supervisor",
    "agency-admin",
    "admin",
    "rc-admin",
    "console",
    "staff",
  ];
  for (const kw of keywords) {
    if (new RegExp(`(^|/)${kw}(/|$)`, "i").test(href)) return true;
  }
  return /\/[^/]+\/login\/?$/i.test(href);
}

function useDrawerFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    const selector =
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = [...el.querySelectorAll<HTMLElement>(selector)].filter((node) => {
        const r = node.getBoundingClientRect();
        return node.offsetParent !== null || r.height > 0 || r.width > 0 || node.tabIndex >= 0;
      });
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first || !el.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !el.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const firstFocusable = el.querySelector<HTMLElement>(selector);
    queueMicrotask(() => firstFocusable?.focus());

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef]);
}

function NavDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/70 hover:text-white lg:px-2.5"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {group.label}
        <ChevronDown className={`size-3.5 opacity-70 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 min-w-[13.5rem] pt-2"
        >
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/95 py-2 shadow-[0_20px_50px_-24px_rgba(56,189,248,0.45)] backdrop-blur-xl">
            {group.items.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                role="menuitem"
                className="block px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MarketingHeader() {
  const login = marketingLoginPath();
  const home = marketingHomePath();
  const pricing = marketingPricingPath();
  const demoRequest = marketingDemoRequestPath("demo");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerPortalMounted, setDrawerPortalMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const drawerTitleId = useId();

  useLayoutEffect(() => {
    setDrawerPortalMounted(true);
  }, []);

  useDrawerFocusTrap(drawerRef, mobileOpen && drawerPortalMounted);

  const restoreMenuButtonFocus = useCallback(() => {
    queueMicrotask(() => menuBtnRef.current?.focus());
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
    restoreMenuButtonFocus();
  }, [restoreMenuButtonFocus]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return undefined;
    }
    document.body.style.overflow = "hidden";
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEscape);
    };
  }, [mobileOpen, closeMobileMenu]);

  const toggleMobileMenu = useCallback(() => {
    setMobileOpen((was) => {
      if (!was) return true;
      restoreMenuButtonFocus();
      return false;
    });
  }, [restoreMenuButtonFocus]);

  const mobileLinks = getMarketingMobileDrawerLinkDefs();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/55">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="grid min-h-[56px] grid-cols-[1fr_auto] items-center gap-3 sm:min-h-[64px] md:min-h-[84px] md:grid-cols-[auto_1fr_auto] md:gap-4">
            <Link
              href={home}
              className="relative z-10 inline-flex max-w-[9.5rem] justify-self-start sm:max-w-[10rem] md:max-w-[11.5rem] lg:max-w-[12.5rem] [-webkit-tap-highlight-color:transparent]"
              onClick={() => mobileOpen && closeMobileMenu()}
            >
              <SiteLogoMark heightClass="h-14 sm:h-16 md:h-20 lg:h-24" priority />
            </Link>

            <div className="hidden justify-self-center md:block">
              <nav
                className="flex w-max items-center gap-0.5 whitespace-nowrap rounded-2xl border border-slate-700/60 bg-gradient-to-r from-slate-950/90 via-slate-900/75 to-slate-950/85 px-2 py-2 text-sm shadow-[0_10px_30px_-20px_rgba(56,189,248,0.45)] lg:gap-1 lg:px-3"
                aria-label="Primary"
              >
                {DROPDOWN_GROUPS.slice(0, 2).map((group) => (
                  <NavDropdown key={group.label} group={group} />
                ))}
                <Link
                  href="/integrations"
                  className="shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/70 hover:text-white lg:px-2.5"
                >
                  Integrations
                </Link>
                <Link
                  href={pricing}
                  className="shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/70 hover:text-white lg:px-2.5"
                >
                  Pricing
                </Link>
                {DROPDOWN_GROUPS.slice(2).map((group) => (
                  <NavDropdown key={group.label} group={group} />
                ))}
              </nav>
            </div>

            <div className="flex items-center justify-end gap-1.5 justify-self-end lg:gap-2">
              <button
                ref={menuBtnRef}
                type="button"
                className="inline-flex size-12 min-h-[3rem] min-w-[3rem] shrink-0 items-center justify-center rounded-xl border border-slate-600/80 bg-slate-900/80 text-white shadow-sm shadow-black/20 transition-colors hover:bg-slate-800/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 md:hidden"
                aria-expanded={mobileOpen}
                aria-controls="marketing-mobile-navigation"
                aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-haspopup="dialog"
                onClick={toggleMobileMenu}
              >
                <Menu className="size-7" aria-hidden strokeWidth={1.75} />
              </button>

              <Link
                href={demoRequest}
                className="hidden shrink-0 rounded-lg bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-950/40 transition-colors hover:bg-sky-500 md:inline-flex"
                onClick={() => trackMarketingEvent(MARKETING_EVENTS.navDemoClick)}
              >
                Request Demo
              </Link>
              <Link
                href={login}
                className="hidden shrink-0 px-2.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 md:inline-flex lg:px-3"
              >
                Agency Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>
      {mobileOpen && drawerPortalMounted
        ? createPortal(
            <div className="fixed inset-0 z-[160] md:hidden">
              <div
                role="presentation"
                className="fixed inset-0 bg-slate-950/72 backdrop-blur-sm"
                onClick={closeMobileMenu}
                aria-hidden
              />

              <div
                ref={drawerRef}
                id="marketing-mobile-navigation"
                role="dialog"
                aria-modal="true"
                aria-labelledby={drawerTitleId}
                tabIndex={-1}
                className="fixed inset-y-0 right-0 z-[161] flex w-[min(100vw-44px,20rem)] max-w-[100vw] flex-col border-l border-cyan-500/10 bg-gradient-to-b from-[#071025] via-[#050b18] to-[#030712] pl-6 pt-[calc(1.25rem+env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_0_0_1px_rgba(148,163,184,0.06),inset_-1px_0_48px_rgba(30,58,138,0.12)] ring-1 ring-white/5"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-700/40 pb-5 pr-1">
                  <div>
                    <p id={drawerTitleId} className="text-lg font-semibold tracking-tight text-white">
                      {DRAWER_TITLE}
                    </p>
                    <p className="mt-2 text-xs leading-snug text-slate-400">{DRAWER_SLOGAN}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close navigation menu"
                    className="-mr-1 inline-flex size-12 min-h-12 min-w-12 shrink-0 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/70 text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                    onClick={closeMobileMenu}
                  >
                    <X className="size-6" aria-hidden strokeWidth={1.75} />
                  </button>
                </div>

                <nav className="mt-6 flex flex-1 flex-col gap-0.5 overflow-y-auto pb-4" aria-label="Mobile navigation">
                  {mobileLinks.map((item) => (
                    <Link
                      key={`${item.label}-${item.href}`}
                      href={item.href}
                      prefetch={false}
                      className="-mx-3 flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-medium tracking-tight text-slate-200 transition-colors hover:bg-slate-800/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
                      onClick={closeMobileMenu}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    href={marketingBookAppointmentUrl()}
                    prefetch={false}
                    className="-mx-3 mt-3 flex min-h-12 items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-center text-base font-semibold tracking-tight text-white shadow-[0_0_20px_rgba(14,165,233,0.25)] transition hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
                    onClick={() => {
                      trackMarketingEvent(MARKETING_EVENTS.navDemoClick);
                      closeMobileMenu();
                    }}
                  >
                    Request Demo
                  </Link>
                  <Link
                    href={login}
                    prefetch={false}
                    className="-mx-3 mt-1 flex min-h-12 items-center justify-center rounded-xl px-4 py-3 text-center text-base font-medium tracking-tight text-slate-400 transition-colors hover:text-slate-200"
                    onClick={closeMobileMenu}
                  >
                    Agency Sign In
                  </Link>
                </nav>

                <p className="mt-auto shrink-0 border-t border-slate-700/30 pt-4 text-[11px] leading-relaxed text-slate-500">
                  {MOBILE_BOOKING_NOTE}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

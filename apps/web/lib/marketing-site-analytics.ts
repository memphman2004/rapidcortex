/**
 * Lightweight GA4 / GTM helpers for marketing conversion events.
 * Kept in web so contact-sales and header can share without importing apps/marketing.
 */

export type MarketingAnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackMarketingEvent(eventName: string, params: MarketingAnalyticsParams = {}): void {
  if (typeof window === "undefined") return;

  const payload = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  );

  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event: eventName, ...payload });
  } catch {
    /* ignore */
  }

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, payload);
    }
  } catch {
    /* ignore */
  }
}

export const MARKETING_EVENTS = {
  homepageSession: "homepage_session",
  heroDemoClick: "hero_demo_click",
  heroPilotClick: "hero_pilot_click",
  productCardClick: "product_card_click",
  demoRequestSubmit: "demo_request_submit",
  pilotRequestSubmit: "pilot_request_submit",
  navDemoClick: "nav_demo_click",
} as const;

"use client";

import { useEffect } from "react";
import { MARKETING_EVENTS, trackMarketingEvent } from "@/lib/marketing-analytics";

/** Fires once per homepage mount for session / page-view attribution. */
export function HomepageAnalytics() {
  useEffect(() => {
    trackMarketingEvent(MARKETING_EVENTS.homepageSession, { page_path: "/" });
  }, []);

  return null;
}

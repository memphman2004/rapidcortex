/**
 * Public store listings for Venue & Campus field apps (QR / NFC installer).
 * Keep in sync with Play Console (`us.rapidcortex.app`) and App Store Connect (`id6811733550`).
 */

export const VENUE_CAMPUS_APPS_LABEL = "Venue & Campus Apps";

export const VENUE_CAMPUS_GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=us.rapidcortex.app";

export const VENUE_CAMPUS_APPLE_APP_STORE_URL =
  "https://apps.apple.com/us/app/nexcort-iq-mobile/id6811733550";

export const VENUE_CAMPUS_ANDROID_PACKAGE = "us.rapidcortex.app";

/** Unlisted App Store listing — share the direct link; not discoverable via search. */
export const VENUE_CAMPUS_IOS_APP_ID = "6811733550";

export const VENUE_CAMPUS_STORE_LINKS = [
  {
    id: "google-play",
    platform: "Google Play",
    label: "Android — NexCort iQ",
    href: VENUE_CAMPUS_GOOGLE_PLAY_URL,
    detail: `Package ${VENUE_CAMPUS_ANDROID_PACKAGE}`,
  },
  {
    id: "apple-app-store",
    platform: "App Store",
    label: "iOS — NexCort iQ Mobile",
    href: VENUE_CAMPUS_APPLE_APP_STORE_URL,
    detail: `App ID ${VENUE_CAMPUS_IOS_APP_ID} (unlisted)`,
  },
] as const;

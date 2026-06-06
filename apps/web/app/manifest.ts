import type { MetadataRoute } from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_PWA_BACKGROUND_COLOR,
  SITE_PWA_THEME_COLOR,
  SITE_PUBLIC_ICON_PATHS,
} from "@/lib/site";

/**
 * Installable/PWA chrome + share targets for mobile browsers.
 * Icons use the same Rapid Cortex square mark (`public/icon-*.png`) as tabs and touch icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: SITE_PWA_BACKGROUND_COLOR,
    theme_color: SITE_PWA_THEME_COLOR,
    icons: [
      {
        src: SITE_PUBLIC_ICON_PATHS.pwa192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: SITE_PUBLIC_ICON_PATHS.pwa512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: SITE_PUBLIC_ICON_PATHS.pwa512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

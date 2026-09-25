import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/product",
        "/pricing",
        "/security",
        "/about",
        "/contact",
        "/request-demo",
        "/rapid-cortex",
        "/legal",
      ],
      disallow: [
        "/enter",
        "/app",
        "/dashboard",
        "/dashboards",
        "/agency-admin",
        "/admin",
        "/rc-admin",
        "/dispatcher",
        "/supervisor",
        "/api",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

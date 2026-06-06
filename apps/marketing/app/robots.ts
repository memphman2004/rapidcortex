import type { MetadataRoute } from "next";

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
    sitemap: "https://www.rapidcortex.us/sitemap.xml",
  };
}

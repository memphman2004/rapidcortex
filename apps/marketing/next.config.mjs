import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "../web");
const marketingRoot = __dirname;

const isProductionBuild = process.argv.includes("build");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: isProductionBuild ? "out" : ".next",
  images: { unoptimized: true },
  trailingSlash: true,
  // Mac Mini / large marketing tree: static pages can exceed the default 60s under load.
  staticPageGenerationTimeout: 300,
  transpilePackages: [
    "rapid-cortex-maps",
    "rapid-cortex-shared",
    "rapid-cortex-protocols",
    "rapid-cortex-integrations",
    "rapid-cortex-security",
  ],
  experimental: {
    externalDir: true,
    // Cap static-generation workers — 9 concurrent workers on a Mini + external volume
    // causes widespread >60s page timeouts during `next build` / `output: "export"`.
    cpus: 2,
  },
  webpack: (config) => {
    const marketingLib = (name) => path.join(marketingRoot, "lib", name);
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/lib/site": marketingLib("site.ts"),
      "@/lib/seo": marketingLib("seo.ts"),
      "@/lib/blog": path.join(marketingRoot, "lib/blog"),
      "@/lib/site/footer-nav": marketingLib("site/footer-nav.ts"),
      "@/components/blog": path.join(marketingRoot, "components/blog"),
      "@/lib/marketing-links": marketingLib("marketing-links.ts"),
      "@/lib/deployment-environment": marketingLib("deployment-environment.ts"),
      "@/components/auth/session-context": path.join(
        marketingRoot,
        "components/auth/session-context.tsx",
      ),
      "@/components/InsideTheCortexPopup": path.join(
        marketingRoot,
        "components/InsideTheCortexPopup.tsx",
      ),
      "@/app/providers": path.join(marketingRoot, "app/providers.tsx"),
      "@": webRoot,
    };
    return config;
  },
};

export default nextConfig;

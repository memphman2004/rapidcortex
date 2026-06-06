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
  transpilePackages: [
    "rapid-cortex-maps",
    "rapid-cortex-shared",
    "rapid-cortex-protocols",
    "rapid-cortex-integrations",
    "rapid-cortex-security",
  ],
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    const marketingLib = (name) => path.join(marketingRoot, "lib", name);
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/lib/site": marketingLib("site.ts"),
      "@/lib/seo": marketingLib("seo.ts"),
      "@/lib/marketing-links": marketingLib("marketing-links.ts"),
      "@/lib/deployment-environment": marketingLib("deployment-environment.ts"),
      "@/components/auth/session-context": path.join(
        marketingRoot,
        "components/auth/session-context.tsx",
      ),
      "@/app/providers": path.join(marketingRoot, "app/providers.tsx"),
      "@": webRoot,
    };
    return config;
  },
};

export default nextConfig;

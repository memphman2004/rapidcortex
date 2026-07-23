import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { SITE_DESCRIPTION, SITE_NAME, SITE_PUBLIC_ICON_PATHS } from "@/lib/site";
import { buildOgShareImage, getSiteUrl } from "@/lib/seo";
import { InsideTheCortexPopup } from "@/components/InsideTheCortexPopup";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = getSiteUrl();
const defaultOgImage = buildOgShareImage(`${SITE_NAME} — branded preview`);
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-S83NHMBHRD";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: SITE_PUBLIC_ICON_PATHS.tab, type: "image/png", sizes: "192x192" },
      { url: SITE_PUBLIC_ICON_PATHS.pwa192, type: "image/png", sizes: "192x192" },
      { url: SITE_PUBLIC_ICON_PATHS.pwa512, type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: SITE_PUBLIC_ICON_PATHS.tab, type: "image/png", sizes: "192x192" }],
    apple: [{ url: SITE_PUBLIC_ICON_PATHS.appleIcon, type: "image/png", sizes: "180x180" }],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: SITE_PUBLIC_ICON_PATHS.appleTouch180,
        sizes: "180x180",
      },
    ],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: siteUrl,
    locale: "en_US",
    images: [defaultOgImage],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: defaultOgImage.url, alt: defaultOgImage.alt }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1e" },
    { media: "(prefers-color-scheme: light)", color: "#0a0f1e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} min-h-full`}>
      <head>
        <Script id="marketing-splash-gate" strategy="beforeInteractive">
          {`(function(){try{var p=location.pathname;if(p!=='/'&&p!=='/index.html')return;if(document.cookie.indexOf('cortex_entered=1')!==-1)return;if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))return;var h=location.hostname;if(h!=='rapidcortex.us'&&h!=='www.rapidcortex.us'&&!h.startsWith('localhost'))return;location.replace('/enter');}catch(e){}})();`}
        </Script>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="beforeInteractive"
        />
        <Script id="google-analytics" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body className="min-h-full min-h-dvh font-sans text-slate-100 antialiased">
        <Providers>{children}</Providers>
        <InsideTheCortexPopup />
      </body>
    </html>
  );
}

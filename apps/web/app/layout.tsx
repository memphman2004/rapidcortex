import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SITE_DESCRIPTION, SITE_NAME, SITE_PUBLIC_ICON_PATHS } from "@/lib/site";
import { absoluteUrl, getSiteUrl, SEO_IMAGE_PATH } from "@/lib/seo";
import { getWorkspaceBuildProbe } from "@/lib/phase1-workspace";
import { DASHBOARD_GOOGLE_FONTS_HREF } from "@/lib/dashboard-font-vars";
import { Providers } from "@/app/providers";
import { ClockPreferenceProvider } from "@/components/providers/clock-preference-provider";
import { FontPreferenceProvider } from "@/components/providers/font-preference-provider";
import { TypographyPreferenceProvider } from "@/components/providers/typography-preference-provider";
import "./globals.css";

const siteUrl = getSiteUrl();
const defaultOgImage = absoluteUrl(SEO_IMAGE_PATH);
const defaultGaId = "G-NGT17QK1LW";
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || defaultGaId;
const gaEnabled = GA_MEASUREMENT_ID.length > 0;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Venue",
    statusBarStyle: "black-translucent",
  },
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
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — branded preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: defaultOgImage, alt: `${SITE_NAME} preview` }],
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
  void getWorkspaceBuildProbe();
  return (
    <html lang="en" className="dark h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={DASHBOARD_GOOGLE_FONTS_HREF} rel="stylesheet" />
        {gaEnabled ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
            </Script>
          </>
        ) : null}
      </head>
      <body className="min-h-full min-h-dvh text-slate-100">
        <Providers>
          <FontPreferenceProvider>
            <TypographyPreferenceProvider>
              <ClockPreferenceProvider>{children}</ClockPreferenceProvider>
            </TypographyPreferenceProvider>
          </FontPreferenceProvider>
        </Providers>
      </body>
    </html>
  );
}

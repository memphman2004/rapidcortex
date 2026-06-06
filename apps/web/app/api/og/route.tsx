import { ImageResponse } from "next/og";
import { SITE_BRAND_MARK_PATH, SITE_NAME, SITE_SLOGAN } from "@/lib/site";
import { absoluteUrl } from "@/lib/seo";

export const runtime = "edge";

const ogSize = { width: 1200, height: 630 } as const;

export function GET() {
  const logoSrc = absoluteUrl(SITE_BRAND_MARK_PATH);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 56,
          padding: "56px 64px",
          background:
            "linear-gradient(135deg, rgba(2,6,23,1) 0%, rgba(15,23,42,1) 45%, rgba(30,41,59,1) 100%)",
          color: "#e2e8f0",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <img
          alt="Rapid Cortex"
          width={240}
          height={240}
          src={logoSrc}
          style={{
            width: 240,
            height: 240,
            objectFit: "contain",
            borderRadius: 36,
            flexShrink: 0,
            boxShadow: "0 18px 60px rgba(2,6,23,0.55)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 28, color: "#38bdf8", letterSpacing: 2, textTransform: "uppercase" }}>
            Public safety AI
          </div>
          <div style={{ fontSize: 72, lineHeight: 1.05, marginTop: 18, fontWeight: 700 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 34, lineHeight: 1.2, marginTop: 20, maxWidth: 980, color: "#cbd5e1" }}>
            {SITE_SLOGAN}
          </div>
        </div>
      </div>
    ),
    ogSize,
  );
}

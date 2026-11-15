import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * robots.txt — NexCort iQ marketing site
 *
 * POLICY SUMMARY
 * ══════════════
 * Search crawlers (indexing + retrieval): ALLOW all public marketing routes
 * AI grounding crawlers (user-directed): ALLOW all public marketing routes
 * AI training crawlers: ALLOW (we want NexCort iQ included in AI knowledge bases)
 * Private app routes, API, auth, admin: DISALLOW for all bots
 *
 * AGENT TAXONOMY (from official provider documentation, as of 2026)
 * ─────────────────────────────────────────────────────────────────
 * Googlebot               — Google Search indexing (allow)
 * Google-Extended         — Gemini AI grounding + Vertex AI (allow — improves AI discovery)
 * OAI-SearchBot           — ChatGPT Search retrieval (allow — primary ChatGPT discovery signal)
 * GPTBot                  — OpenAI training data (allow — builds ChatGPT knowledge base)
 * ChatGPT-User            — User-directed ChatGPT real-time browsing (allow)
 * ClaudeBot               — Anthropic Claude search/knowledge (allow)
 * Claude-SearchBot        — Anthropic Claude search retrieval (allow)
 * Claude-User             — User-directed Claude browsing (allow)
 * PerplexityBot           — Perplexity search indexing/retrieval (allow)
 * Perplexity-User         — User-directed Perplexity browsing (allow)
 * Bingbot                 — Microsoft Bing Search (allow)
 * BingPreview             — Bing link previews (allow)
 * msnbot                  — Bing ecosystem (allow)
 * LinkedInBot             — LinkedIn link previews (allow)
 * facebookexternalhit     — Facebook link previews (allow)
 * DuckDuckBot             — DuckDuckGo search (allow)
 * CCBot                   — Common Crawl (used by many AI systems, allow public pages)
 *
 * NOTE: robots.txt controls declared permissions, not enforcement.
 * AWS WAF and CloudFront security rules are independent controls.
 * Verified AI search engine crawlers should not be challenged by WAF at the
 * CloudFront edge — test WAF rules separately for each crawler's published
 * IP ranges (Perplexity publishes theirs explicitly for AWS WAF configuration).
 *
 * NEVER expose via robots.txt or any public route:
 *   – Agency incident records, transcripts, or CAD data
 *   – Internal admin dashboards or API endpoints
 *   – Authentication flows or JWT token handlers
 *   – Per-agency operational consoles
 */

/** Paths that must never be crawled by any bot. */
const DISALLOW_ALL = [
  "/enter",          // marketing splash gate
  "/app",            // operational app routes
  "/dashboard",      // dispatcher/agency dashboards
  "/dashboards",
  "/agency-admin",
  "/admin",
  "/rc-admin",       // internal RC admin portal
  "/dispatcher",
  "/supervisor",
  "/api",            // all API routes
  "/auth",           // Cognito callback handlers
  "/login",
  "/signup",
  "/_next",          // Next.js internals
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── Default: all well-behaved crawlers ────────────────────────────────
      {
        userAgent: "*",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },

      // ── Google Search + Gemini AI grounding ───────────────────────────────
      // Google-Extended controls Gemini API + Vertex AI grounding (separate from Googlebot).
      // Allowing Google-Extended improves NexCort iQ discovery when buyers ask Gemini.
      {
        userAgent: "Googlebot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "Google-Extended",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },

      // ── OpenAI / ChatGPT ──────────────────────────────────────────────────
      // OAI-SearchBot: ChatGPT Search visibility (primary signal for ChatGPT discovery).
      // GPTBot: model training (allow — builds NexCort iQ into ChatGPT knowledge).
      // ChatGPT-User: real-time browsing when a ChatGPT user asks for current info.
      {
        userAgent: "OAI-SearchBot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "GPTBot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "ChatGPT-User",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },

      // ── Anthropic / Claude ────────────────────────────────────────────────
      // Both ClaudeBot and Claude-SearchBot are documented by Anthropic.
      // Claude-User controls user-directed Claude browsing in real-time.
      {
        userAgent: "ClaudeBot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "Claude-SearchBot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "Claude-User",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },

      // ── Perplexity ────────────────────────────────────────────────────────
      // PerplexityBot crawls for search retrieval; Perplexity-User is user-directed.
      // Perplexity publishes its crawler IP ranges for AWS WAF configuration —
      // verify those ranges are not challenged in the CloudFront WAF separately.
      {
        userAgent: "PerplexityBot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "Perplexity-User",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },

      // ── Microsoft Bing ────────────────────────────────────────────────────
      // Bingbot also feeds Microsoft Copilot grounding (Bing-powered).
      {
        userAgent: "Bingbot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "BingPreview",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "msnbot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },

      // ── Social / link-preview crawlers ────────────────────────────────────
      {
        userAgent: "LinkedInBot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "facebookexternalhit",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
      {
        userAgent: "DuckDuckBot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },

      // ── Common Crawl ──────────────────────────────────────────────────────
      // CCBot feeds many open-source and commercial AI datasets.
      {
        userAgent: "CCBot",
        allow: ["/"],
        disallow: DISALLOW_ALL,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

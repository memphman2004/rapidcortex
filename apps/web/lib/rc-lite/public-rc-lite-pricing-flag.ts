/** When false, RC Lite tiers stay quote-only regardless of tier metadata shipped in-repo. */

export function showPublicRcLitePricing(): boolean {
  const explicit = process.env.NEXT_PUBLIC_SHOW_RC_LITE_PUBLIC_PRICING ?? process.env.NEXT_PUBLIC_SHOW_PUBLIC_PRICING;
  return explicit === "true" || explicit === "1";
}

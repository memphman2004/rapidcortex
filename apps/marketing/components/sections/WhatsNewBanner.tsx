/**
 * Thin announcement strip for the top of every marketing page.
 * Lives above the nav and deep-links to the homepage new-features block.
 * Native <a> (not next/link) so the #new-features hash is preserved on the homepage.
 */
export function WhatsNewBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm"
      style={{
        background: "rgba(20, 105, 255, 0.06)",
        borderBottom: "1px solid #1A2940",
      }}
    >
      <span className="flex shrink-0 items-center gap-2">
        <span
          className="rc-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-[#E8192C]"
          aria-hidden="true"
        />
        <span className="font-medium text-[#E8EEF8]">What&apos;s new</span>
      </span>

      <span className="text-[#3A4F72]" aria-hidden="true">
        ·
      </span>

      <span className="text-[#6A7B9D]">CAD-to-CAD interoperability&nbsp; · &nbsp;311 AI call handling</span>

      <a href="/#new-features" className="shrink-0 font-medium text-[#1469FF] hover:underline">
        See the capabilities →
      </a>
    </div>
  );
}

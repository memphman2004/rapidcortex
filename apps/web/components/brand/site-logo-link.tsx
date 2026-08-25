import Image from "next/image";
import Link from "next/link";
import {
  SITE_LOGO_HEIGHT,
  SITE_LOGO_PATH,
  SITE_LOGO_WIDTH,
  SITE_NAME,
  SITE_SQUARE_ICON_HEIGHT,
  SITE_SQUARE_ICON_PATH,
  SITE_SQUARE_ICON_WIDTH,
} from "@/lib/site";

type SiteLogoMarkProps = {
  /** Tailwind height class (width follows aspect ratio). */
  heightClass?: string;
  className?: string;
  priority?: boolean;
};

/** Rapid Cortex mark — image only (`SITE_LOGO_PATH`, Rapid 911 brand asset). */
export function SiteLogoMark({
  heightClass = "h-10",
  className = "",
  priority = false,
}: SiteLogoMarkProps) {
  return (
    <Image
      src={SITE_LOGO_PATH}
      alt={SITE_NAME}
      width={SITE_LOGO_WIDTH}
      height={SITE_LOGO_HEIGHT}
      priority={priority}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      unoptimized
      sizes="(max-width: 1024px) 160px, 200px"
      className={[
        "inline-block w-auto max-w-full shrink-0 object-contain object-left",
        heightClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

type SiteSquareMarkProps = {
  /** Display size in px (intrinsic asset is 256×256). */
  size?: number;
  className?: string;
  priority?: boolean;
  /** Optional border radius on the mark container. */
  borderRadius?: number;
};

/** Compact square Rapid Cortex icon for dashboard sidebars / chrome. */
export function SiteSquareMark({
  size = 34,
  className = "",
  priority = false,
  borderRadius = 7,
}: SiteSquareMarkProps) {
  return (
    <span
      className={["inline-flex shrink-0 overflow-hidden", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, borderRadius }}
    >
      <Image
        src={SITE_SQUARE_ICON_PATH}
        alt={SITE_NAME}
        width={SITE_SQUARE_ICON_WIDTH}
        height={SITE_SQUARE_ICON_HEIGHT}
        priority={priority}
        unoptimized
        sizes={`${size}px`}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "block",
        }}
      />
    </span>
  );
}

type SiteLogoLinkProps = SiteLogoMarkProps & {
  href: string;
  /** Classes on the anchor (default keeps logo sizing). */
  linkClassName?: string;
};

/** Logo wrapped in a link (e.g. home or marketing root). */
export function SiteLogoLink({
  href,
  heightClass = "h-10",
  className,
  linkClassName = "inline-flex shrink-0 items-center",
  priority = false,
}: SiteLogoLinkProps) {
  return (
    <Link href={href} className={linkClassName}>
      <SiteLogoMark heightClass={heightClass} className={className} priority={priority} />
    </Link>
  );
}

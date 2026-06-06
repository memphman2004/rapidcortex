import Image from "next/image";
import Link from "next/link";
import {
  SITE_LOGO_HEIGHT,
  SITE_LOGO_PATH,
  SITE_LOGO_WIDTH,
  SITE_NAME,
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
      className={["inline-block w-auto shrink-0", heightClass, className].filter(Boolean).join(" ")}
    />
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

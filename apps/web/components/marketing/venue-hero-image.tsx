import Image from "next/image";

export const VENUE_HERO_IMAGE = {
  src: "/images/venue-hero.webp",
  width: 1672,
  height: 941,
  alt: "Rapid Cortex Venue Command — stadium security operations, help tower, and live camera feeds at night",
} as const;

/** LCP hero — static export has no `/_next/image`; serve the 172KB WebP directly. */
export function VenueHeroImage() {
  return (
    <Image
      src={VENUE_HERO_IMAGE.src}
      alt={VENUE_HERO_IMAGE.alt}
      width={VENUE_HERO_IMAGE.width}
      height={VENUE_HERO_IMAGE.height}
      priority
      unoptimized
      sizes="100vw"
      className="absolute inset-0 h-full w-full object-cover object-[68%_center] sm:object-center"
    />
  );
}

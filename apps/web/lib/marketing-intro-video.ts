/** Introductory marketing video (YouTube). */
export const MARKETING_INTRO_YOUTUBE_ID = "NSRJKfNWAzs";

export function marketingIntroYoutubeWatchUrl(): string {
  return `https://www.youtube.com/watch?v=${MARKETING_INTRO_YOUTUBE_ID}`;
}

export function marketingIntroYoutubeEmbedUrl(options?: { autoplay?: boolean }): string {
  const params = new URLSearchParams();
  if (options?.autoplay) params.set("autoplay", "1");
  params.set("rel", "0");
  const q = params.toString();
  return `https://www.youtube.com/embed/${MARKETING_INTRO_YOUTUBE_ID}${q ? `?${q}` : ""}`;
}

/**
 * Server / Edge–safe user-agent classification for operational auth blocking.
 * Does not use CSS or media queries.
 */

/**
 * When true, phones and (by default) tablets cannot start console auth or hit protected app routes.
 * Set to `false` or `0` to allow mobile auth (e.g. local dev).
 * If unset: **production** defaults to blocking; non-production defaults to allowing (dev ergonomics).
 */
export function isMobileOperationalAuthBlockingEnabled(): boolean {
  const raw = readEnv("DISABLE_MOBILE_AUTH") ?? readEnv("NEXT_PUBLIC_DISABLE_MOBILE_AUTH");
  const v = raw?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * When true (default), tablet-class UAs are blocked the same as phones.
 * Set `BLOCK_TABLET_AUTH=false` to allow tablets (still subject to DISABLE_MOBILE_AUTH).
 */
export function shouldBlockTabletClassDevices(): boolean {
  const raw = readEnv("BLOCK_TABLET_AUTH");
  const v = raw?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

function readEnv(key: string): string | undefined {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

/** iPad (incl. some desktop-mode UAs), Android tablets, common tablet tokens. */
export function isTabletUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false;
  const ua = userAgent.trim();
  const low = ua.toLowerCase();

  if (/\bipad\b/i.test(ua)) return true;
  if (/\bipad\b|\btablet\b|\bplaybook\b/i.test(low)) return true;
  if (/\bsilk\b/i.test(ua) && /\bamazon\b/i.test(low)) return true;

  // Android: many tablets omit "Mobile" in UA; phones usually include Mobile.
  if (/\bandroid\b/i.test(ua) && !/\bmobile\b/i.test(ua)) return true;

  // iPadOS 13+ “desktop” Safari often reports Macintosh without “iPad”
  if (/\bmozilla\/5\.0 \(macintosh\b/i.test(ua) && /\btouch\b/i.test(ua)) return true;

  return false;
}

/**
 * Phones and mobile browsers (excludes tablet-only UA where classifiable as tablet first).
 */
/** Phones and phone-class mobile browsers — excludes tablet UAs (`isTabletUserAgent` handles those). */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false;
  if (isTabletUserAgent(userAgent)) return false;

  const ua = userAgent.trim();
  const low = ua.toLowerCase();

  if (/\biphone\b|\bipod\b/i.test(ua)) return true;
  if (/\bwindows phone\b|\b(?:iemobile|opera mobi|opera tablet)\b/i.test(low)) return true;
  if (/\bmobile safari\b/i.test(low) && !/\bipad\b/i.test(low)) return true;
  if (/\b(?:samsung|samsungbrowser)\/.*mobile\b/i.test(low)) return true;
  if (/\chrome\/[\d.]+\smobile\b/i.test(low)) return true;
  if (/\bfirefox\/[\d.]+\bmobile\b/i.test(low)) return true;

  // Generic mobile Android phone
  if (/\bandroid\b/i.test(ua) && /\bmobile\b/i.test(low)) return true;

  // Client hint (when present on requests)
  if (/\bmobile\b/i.test(low) && /\bandroid\b.*\bchrome\b/i.test(low)) return true;

  return false;
}

/**
 * Whether this device must be blocked from operational auth and console routes.
 */
export function shouldBlockAuthOnDevice(userAgent: string | null | undefined): boolean {
  if (!isMobileOperationalAuthBlockingEnabled()) return false;

  const ua = userAgent?.trim() ?? "";

  // Production: missing UA is treated as untrusted for enforcement.
  if (!ua) {
    return process.env.NODE_ENV === "production";
  }

  if (isTabletUserAgent(userAgent)) {
    return shouldBlockTabletClassDevices();
  }
  if (isMobileUserAgent(userAgent)) {
    return true;
  }
  return false;
}

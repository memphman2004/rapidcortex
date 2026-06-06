/**
 * Optional hosted mirror of the repository `docs/` tree (GitHub blob view, internal wiki, etc.).
 * Example: `https://github.com/YourOrg/your-repo/blob/main/docs`
 * Omit in environments where operators only use the repo checkout.
 */
export function getDocumentationBaseUrl(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const raw = process.env.NEXT_PUBLIC_DOCUMENTATION_BASE_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}

/** Returns an absolute URL to a markdown file under the configured docs base, or `undefined`. */
export function hostedDocHref(filename: string): string | undefined {
  const base = getDocumentationBaseUrl();
  if (!base) return undefined;
  const f = filename.replace(/^\//, "");
  return `${base}/${f}`;
}

/** Canonical path string for copy-paste when no hosted base is configured. */
export function repoDocPath(filename: string): string {
  const f = filename.replace(/^\//, "");
  return `docs/${f}`;
}

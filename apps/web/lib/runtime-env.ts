/**
 * Browser-safe deployment label for the environment badge (never contains secrets).
 */
export function getDeploymentEnvironment(): string {
  if (typeof process === "undefined") return "local";
  const explicit = process.env.NEXT_PUBLIC_APP_ENV?.trim();
  if (explicit) return explicit;
  const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV?.trim();
  if (vercel) return vercel;
  return "local";
}

export function isProductionLikeEnvironment(): boolean {
  const e = getDeploymentEnvironment().toLowerCase();
  return e === "production" || e === "prod";
}

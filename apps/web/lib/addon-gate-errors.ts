/** True when an API/BFF error indicates a billing add-on gate (403), not auth failure. */
export function isAddonNotEnabledError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return /addon_not_enabled|action_not_enabled|Feature unavailable/i.test(msg);
}

/** True for add-on gates or generic Forbidden bodies that should soft-fail optional widgets. */
export function isOptionalFeatureForbiddenError(error: unknown): boolean {
  if (isAddonNotEnabledError(error)) return true;
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return /\b403\b|Request failed 403|Queue fetch failed: 403/i.test(msg);
}

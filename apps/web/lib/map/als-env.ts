/** True when ALS map resource names (or identity pool) are present for tile requests. */
export function isAlsMapConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_ALS_MAP_NAME?.trim() ||
      process.env.NEXT_PUBLIC_ALS_MAP_NAME_DARK?.trim() ||
      process.env.NEXT_PUBLIC_ALS_IDENTITY_POOL_ID?.trim(),
  );
}

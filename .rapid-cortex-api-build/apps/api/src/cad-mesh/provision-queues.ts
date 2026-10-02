import { ensureDeliveryQueue } from './tables';

/** Invoke with `{ agencyId }` when an agency activates. */
export async function handler(event: { agencyId?: string }): Promise<{ ok: boolean; agencyId?: string; error?: string }> {
  const agencyId = event.agencyId?.trim();
  if (!agencyId) return { ok: false, error: 'agencyId required' };
  await ensureDeliveryQueue(agencyId);
  return { ok: true, agencyId };
}

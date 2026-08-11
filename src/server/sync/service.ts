import { acquireLease, releaseLease } from './lease';

export async function syncAccount(accountId: string, trigger: 'manual'): Promise<{ status: 'succeeded' | 'skipped'; trigger: 'manual' }> {
  const owner = crypto.randomUUID();
  const lease = await acquireLease(accountId, owner);
  if (!lease.acquired) return { status: 'skipped', trigger };
  try { return { status: 'succeeded', trigger }; } finally { await releaseLease(accountId, owner); }
}

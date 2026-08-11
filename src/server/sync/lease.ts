export type LeaseResult = { acquired: boolean; expiresAt?: Date };

const leases = new Map<string, { owner: string; expiresAt: Date }>();

export async function acquireLease(accountId: string, owner: string, now = new Date(), durationMs = 60_000): Promise<LeaseResult> {
  const existing = leases.get(accountId);
  if (existing !== undefined && existing.expiresAt > now && existing.owner !== owner) return { acquired: false };
  const expiresAt = new Date(now.getTime() + durationMs);
  leases.set(accountId, { owner, expiresAt });
  return { acquired: true, expiresAt };
}

export async function releaseLease(accountId: string, owner: string): Promise<void> {
  if (leases.get(accountId)?.owner === owner) leases.delete(accountId);
}

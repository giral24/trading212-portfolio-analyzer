import { and, eq, lte, or } from 'drizzle-orm';

import { getDb, type DrizzleDatabase } from '@/db/index';
import { syncLeases } from '@/db/schema';

export type LeaseResult = { acquired: boolean; expiresAt?: Date };
export type LeaseOptions = { db?: DrizzleDatabase; now?: Date; durationMs?: number };

/** Atomically replaces only this owner's or an expired lease. */
export async function acquireLease(accountId: string, owner: string, options: LeaseOptions = {}): Promise<LeaseResult> {
  const db = options.db ?? getDb();
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (options.durationMs ?? 60_000));
  const [lease] = await db.insert(syncLeases).values({ accountId, owner, expiresAt, updatedAt: now })
    .onConflictDoUpdate({
      target: syncLeases.accountId,
      set: { owner, expiresAt, updatedAt: now },
      where: or(lte(syncLeases.expiresAt, now), eq(syncLeases.owner, owner)),
    })
    .returning({ owner: syncLeases.owner, expiresAt: syncLeases.expiresAt });
  return lease?.owner === owner ? { acquired: true, expiresAt: lease.expiresAt } : { acquired: false };
}

export async function releaseLease(accountId: string, owner: string, db: DrizzleDatabase = getDb()): Promise<void> {
  await db.delete(syncLeases).where(and(eq(syncLeases.accountId, accountId), eq(syncLeases.owner, owner)));
}

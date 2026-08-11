import { createHash } from 'node:crypto';

import Decimal from 'decimal.js';
import { and, eq, or } from 'drizzle-orm';

import { getDb, type DrizzleDatabase } from '@/db/index';
import {
  cashTransactions,
  classifications,
  dividends,
  importSources,
  instruments,
  orders,
  rawEvents,
  reconciliationIssues,
  syncCheckpoints,
} from '@/db/schema';

import { normalizeEvent, type NormalizedEvent, type ProviderEvent } from './normalize';

export type Checkpoint = { cursor: string | null; watermark: Date | null };
export type ProviderPage = {
  source: string;
  stream: string;
  accountId: string;
  items: ProviderEvent[];
  observedAt?: Date;
  checkpoint?: Checkpoint;
  provenance?: { sourceHash: string; parserVersion?: string; rangeStart?: Date | null; rangeEnd?: Date | null };
};
export type IngestionCounters = { created: number; ignored: number; unknown: number };
export type IngestOptions = { db?: DrizzleDatabase };

const POLICY_VERSION = 'normalization-v1';

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function providerName(source: string): string {
  return source.split(':', 1)[0] ?? source;
}

function isCashEvent(type: NormalizedEvent['type']): boolean {
  return ['deposit', 'withdrawal', 'interest', 'fee', 'tax', 'internal_transfer', 'correction'].includes(type);
}

function nonEmpty(value: string | null): value is string {
  return value !== null && value.length > 0;
}

async function findOrCreateInstrument(
  db: DrizzleDatabase,
  event: NormalizedEvent,
  source: string,
): Promise<string | null> {
  if (!nonEmpty(event.instrumentExternalId)) return null;
  const provider = providerName(source);
  await db.insert(instruments).values({
    provider,
    externalInstrumentId: event.instrumentExternalId,
    ticker: event.ticker ?? event.instrumentExternalId,
  }).onConflictDoNothing();
  const [instrument] = await db.select({ id: instruments.id })
    .from(instruments)
    .where(and(eq(instruments.provider, provider), eq(instruments.externalInstrumentId, event.instrumentExternalId)))
    .limit(1);
  return instrument?.id ?? null;
}

async function createUnknownIssue(
  db: DrizzleDatabase,
  input: { accountId: string; rawEventId: string; source: string; observedAt: Date; reason: string },
): Promise<void> {
  await db.insert(reconciliationIssues).values({
    accountId: input.accountId,
    rawEventId: input.rawEventId,
    issueType: 'unknown_event',
    severity: 'warning',
    status: 'open',
    evidence: { source: input.source, reason: input.reason },
    observedAt: input.observedAt,
  });
}

async function persistDerivedRecord(
  db: DrizzleDatabase,
  input: { accountId: string; rawEventId: string; source: string; hash: string; event: NormalizedEvent; observedAt: Date },
): Promise<boolean> {
  const { event } = input;
  const externalId = event.externalId ?? input.hash;

  if (event.type === 'buy' || event.type === 'sell') {
    const instrumentId = await findOrCreateInstrument(db, event, input.source);
    if (!nonEmpty(event.quantity) || !nonEmpty(event.currency) || event.occurredAt === null || instrumentId === null) return true;
    const grossValue = event.grossAmount ?? (event.price === null ? null : new Decimal(event.quantity).times(event.price).toFixed());
    if (grossValue === null) return true;
    await db.insert(orders).values({
      accountId: input.accountId,
      instrumentId,
      rawEventId: input.rawEventId,
      source: input.source,
      externalId,
      sourceHash: input.hash,
      side: event.type,
      status: event.status,
      quantity: event.quantity,
      price: event.price,
      grossValue,
      fee: event.fee ?? '0',
      accountCurrency: event.currency,
      executedAt: event.occurredAt,
      observedAt: input.observedAt,
      rawPayload: event.raw,
    }).onConflictDoNothing();
    return false;
  }

  if (event.type === 'dividend') {
    const instrumentId = await findOrCreateInstrument(db, event, input.source);
    if (!nonEmpty(event.netAmount) || !nonEmpty(event.currency) || event.occurredAt === null) return true;
    await db.insert(dividends).values({
      accountId: input.accountId,
      instrumentId,
      rawEventId: input.rawEventId,
      source: input.source,
      externalId,
      sourceHash: input.hash,
      grossAmount: event.grossAmount ?? event.netAmount,
      withheldAmount: event.withheldAmount ?? '0',
      netAmount: event.netAmount,
      accountCurrency: event.currency,
      paidAt: event.occurredAt,
      observedAt: input.observedAt,
      rawPayload: event.raw,
    }).onConflictDoNothing();
    return false;
  }

  if (isCashEvent(event.type)) {
    if (!nonEmpty(event.amount) || !nonEmpty(event.currency) || event.occurredAt === null) return true;
    await db.insert(cashTransactions).values({
      accountId: input.accountId,
      rawEventId: input.rawEventId,
      source: input.source,
      externalId,
      sourceHash: input.hash,
      transactionType: event.type,
      amountOriginalCurrency: event.amount,
      originalCurrency: event.currency,
      amountAccountCurrency: event.amount,
      accountCurrency: event.currency,
      occurredAt: event.occurredAt,
      observedAt: input.observedAt,
      rawPayload: event.raw,
    }).onConflictDoNothing();
    return false;
  }

  return event.type === 'unknown' || event.type === 'corporate_action';
}

/**
 * Writes one page atomically. A checkpoint is advanced only after every raw
 * event, derived record, classification, and review issue is committed.
 */
export async function ingestPage(page: ProviderPage, options: IngestOptions = {}): Promise<IngestionCounters> {
  const db = options.db ?? getDb();
  const observedAt = page.observedAt ?? new Date();
  const sourceHash = page.provenance?.sourceHash ?? hash({ source: page.source, stream: page.stream });
  const counters: IngestionCounters = { created: 0, ignored: 0, unknown: 0 };

  await db.transaction(async (tx) => {
    await tx.insert(importSources).values({
      accountId: page.accountId,
      source: page.source,
      sourceHash,
      parserVersion: page.provenance?.parserVersion ?? POLICY_VERSION,
      rangeStart: page.provenance?.rangeStart ?? null,
      rangeEnd: page.provenance?.rangeEnd ?? null,
      observedAt,
      rawPayload: { stream: page.stream },
    }).onConflictDoNothing();
    const [importSource] = await tx.select({ id: importSources.id })
      .from(importSources)
      .where(and(eq(importSources.accountId, page.accountId), eq(importSources.source, page.source), eq(importSources.sourceHash, sourceHash)))
      .limit(1);
    if (importSource === undefined) throw new Error('Could not establish import provenance.');

    for (const item of page.items) {
      const event = normalizeEvent(item);
      const canonicalHash = hash({ accountId: page.accountId, source: page.source, raw: event.raw });
      const identity = event.externalId === null
        ? eq(rawEvents.canonicalHash, canonicalHash)
        : or(and(eq(rawEvents.source, page.source), eq(rawEvents.externalId, event.externalId)), eq(rawEvents.canonicalHash, canonicalHash));
      const [existing] = await tx.select({ id: rawEvents.id }).from(rawEvents).where(identity).limit(1);
      if (existing !== undefined) {
        counters.ignored += 1;
        continue;
      }

      const [rawEvent] = await tx.insert(rawEvents).values({
        accountId: page.accountId,
        importSourceId: importSource.id,
        source: page.source,
        externalId: event.externalId,
        canonicalHash,
        providerType: event.providerType,
        occurredAt: event.occurredAt,
        observedAt,
        rawPayload: event.raw,
      }).onConflictDoNothing().returning({ id: rawEvents.id });

      if (rawEvent === undefined) {
        counters.ignored += 1;
        continue;
      }

      counters.created += 1;
      const derivedUnknown = await persistDerivedRecord(tx as DrizzleDatabase, {
        accountId: page.accountId,
        rawEventId: rawEvent.id,
        source: page.source,
        hash: canonicalHash,
        event,
        observedAt,
      });
      const normalizedType = derivedUnknown ? 'unknown' : event.type;
      await tx.insert(classifications).values({
        accountId: page.accountId,
        rawEventId: rawEvent.id,
        normalizedType,
        policyVersion: POLICY_VERSION,
        source: 'rule',
        observedAt,
      });
      if (normalizedType === 'unknown') {
        counters.unknown += 1;
        await createUnknownIssue(tx as DrizzleDatabase, {
          accountId: page.accountId,
          rawEventId: rawEvent.id,
          source: page.source,
          observedAt,
          reason: event.type === 'unknown' ? 'Unrecognized provider type.' : 'Required accounting fields were unavailable.',
        });
      }
    }

    if (page.checkpoint !== undefined) {
      await tx.insert(syncCheckpoints).values({
        accountId: page.accountId,
        stream: page.stream,
        cursor: page.checkpoint.cursor,
        watermark: page.checkpoint.watermark,
        updatedAt: observedAt,
      }).onConflictDoUpdate({
        target: [syncCheckpoints.accountId, syncCheckpoints.stream],
        set: { cursor: page.checkpoint.cursor, watermark: page.checkpoint.watermark, updatedAt: observedAt },
      });
    }
  });

  return counters;
}

import { createHash, randomUUID } from 'node:crypto';

import Decimal from 'decimal.js';
import { and, asc, desc, eq, gt, inArray, lte } from 'drizzle-orm';

import { getDb, type DrizzleDatabase } from '@/db/index';
import {
  accountSnapshots,
  accounts,
  cashTransactions,
  dividends,
  instruments,
  lotDisposals,
  lots,
  orders,
  positionSnapshots,
  reconciliationIssues,
  syncCheckpoints,
  syncRuns,
} from '@/db/schema';
import { allocateFifoSale } from '@/domain/lots';

import { ingestPage, type IngestionCounters } from '../import/ingest';
import type { ProviderEvent } from '../import/normalize';
import { acquireLease, releaseLease } from './lease';

const FIFO_POLICY_VERSION = 'fifo-v1';
const RECONCILIATION_TOLERANCE = new Decimal('0.01');

export type ProviderHistoryPage = { items: ProviderEvent[]; nextPagePath: string | null };
export type SyncClient = {
  getSummary(): Promise<unknown>;
  getPositions(): Promise<unknown>;
  listOrders(nextPagePath?: string): Promise<ProviderHistoryPage>;
  listTransactions(nextPagePath?: string): Promise<ProviderHistoryPage>;
  listDividends(nextPagePath?: string): Promise<ProviderHistoryPage>;
};
export type SyncResult = {
  status: 'succeeded' | 'partial' | 'failed' | 'skipped';
  trigger: 'manual';
  created: number;
  ignored: number;
  unknown: number;
  pageCount: number;
  safeErrorCode?: 'provider_response_invalid' | 'provider_request_failed' | 'account_not_found';
};
export type SyncOptions = { client: SyncClient; db?: DrizzleDatabase; now?: () => Date; owner?: string };

type Summary = {
  cashValue: string;
  investedValue: string;
  totalValue: string;
  currency: string;
  observedAt: Date;
  raw: Record<string, unknown>;
};

type ValidatedPosition = {
  raw: Record<string, unknown>;
  externalInstrumentId: string | null;
  quantity: string | null;
  price: string | null;
  marketValue: string | null;
  ticker: string | null;
};

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function decimalString(value: string | null, message: string): string {
  if (value === null) throw new Error(message);
  try {
    return new Decimal(value).toFixed();
  } catch {
    throw new Error(message);
  }
}

function parseSummary(value: unknown, observedAt: Date): Summary {
  const raw = asRecord(value, 'Provider summary must be an object.');
  const cashValue = decimalString(firstString(raw, ['cashValue', 'cash', 'cashBalance']), 'Provider summary has no valid cash value.');
  const totalValue = decimalString(firstString(raw, ['totalValue', 'total', 'portfolioValue']), 'Provider summary has no valid total value.');
  const investedCandidate = firstString(raw, ['investedValue', 'investmentsValue', 'invested']);
  const investedValue = investedCandidate === null ? new Decimal(totalValue).minus(cashValue).toFixed() : decimalString(investedCandidate, 'Provider summary has no valid invested value.');
  const currency = firstString(raw, ['accountCurrency', 'currency', 'currencyCode']);
  if (currency === null) throw new Error('Provider summary has no currency.');
  const providerObservedAt = firstString(raw, ['observedAt', 'timestamp', 'asOf']);
  const parsedObservedAt = providerObservedAt === null ? observedAt : new Date(providerObservedAt);
  if (Number.isNaN(parsedObservedAt.getTime())) throw new Error('Provider summary has an invalid observation time.');
  return { cashValue, investedValue, totalValue, currency, observedAt: parsedObservedAt, raw };
}

/** Validates the complete provider array before any snapshot write begins. */
function parsePositions(value: unknown): ValidatedPosition[] {
  if (!Array.isArray(value)) throw new Error('Provider positions must be an array.');
  return value.map((entry) => {
    const raw = asRecord(entry, 'Provider position must be an object.');
    const quantity = firstString(raw, ['quantity', 'currentQuantity']);
    const price = firstString(raw, ['price', 'currentPrice', 'averagePrice']);
    const marketValue = firstString(raw, ['marketValue', 'value', 'currentValue']);
    return {
      raw,
      externalInstrumentId: firstString(raw, ['instrumentId', 'instrumentCode', 'isin', 'ticker']),
      quantity: quantity === null ? null : decimalString(quantity, 'Provider position has an invalid quantity.'),
      price: price === null ? null : decimalString(price, 'Provider position has an invalid price.'),
      marketValue: marketValue === null ? null : decimalString(marketValue, 'Provider position has an invalid market value.'),
      ticker: firstString(raw, ['ticker', 'symbol']),
    };
  });
}

function snapshotHash(accountId: string, summary: Summary): string {
  // Provider payload is sufficient for immutable content; the instant makes a fresh observation append-only.
  return createHash('sha256').update(JSON.stringify({ accountId, raw: summary.raw, observedAt: summary.observedAt.toISOString() })).digest('hex');
}

async function persistSnapshot(
  db: DrizzleDatabase,
  accountId: string,
  syncRunId: string,
  summary: Summary,
  positionsValue: unknown,
  observedAt: Date,
): Promise<void> {
  const positions = parsePositions(positionsValue);
  await db.transaction(async (tx) => {
    const transaction = tx as DrizzleDatabase;
    const [snapshot] = await transaction.insert(accountSnapshots).values({
      accountId,
      syncRunId,
      source: 'trading212:summary',
      sourceHash: snapshotHash(accountId, summary),
      cashValue: summary.cashValue,
      investedValue: summary.investedValue,
      totalValue: summary.totalValue,
      accountCurrency: summary.currency,
      observedAt: summary.observedAt,
      rawPayload: summary.raw,
    }).onConflictDoNothing().returning({ id: accountSnapshots.id });
    if (snapshot === undefined) return;

    for (const position of positions) {
      if (position.externalInstrumentId === null || position.quantity === null) {
        await transaction.insert(reconciliationIssues).values({
          accountId,
          syncRunId,
          issueType: 'position_without_identity',
          severity: 'warning',
          status: 'open',
          evidence: { raw: position.raw },
          observedAt,
        });
        continue;
      }
      const provider = 'trading212';
      await transaction.insert(instruments).values({ provider, externalInstrumentId: position.externalInstrumentId, ticker: position.ticker ?? position.externalInstrumentId }).onConflictDoNothing();
      const [instrument] = await transaction.select({ id: instruments.id }).from(instruments)
        .where(and(eq(instruments.provider, provider), eq(instruments.externalInstrumentId, position.externalInstrumentId))).limit(1);
      if (instrument === undefined) throw new Error('Could not resolve provider instrument.');
      const sourceHash = createHash('sha256').update(JSON.stringify({ accountId, raw: position.raw, observedAt: summary.observedAt.toISOString() })).digest('hex');
      await transaction.insert(positionSnapshots).values({
        accountId,
        instrumentId: instrument.id,
        accountSnapshotId: snapshot.id,
        source: 'trading212:positions',
        sourceHash,
        quantity: position.quantity,
        price: position.price,
        marketValue: position.marketValue,
        accountCurrency: summary.currency,
        observedAt,
        rawPayload: position.raw,
      }).onConflictDoNothing();
    }
  });
}

async function rebuildLots(db: DrizzleDatabase, accountId: string, syncRunId: string, observedAt: Date, currency: string): Promise<void> {
  const existingLots = await db.select({ id: lots.id }).from(lots).where(eq(lots.accountId, accountId));
  if (existingLots.length > 0) {
    await db.delete(lotDisposals).where(inArray(lotDisposals.lotId, existingLots.map((lot) => lot.id)));
    await db.delete(lots).where(eq(lots.accountId, accountId));
  }

  const history = await db.select({
    id: orders.id,
    instrumentId: orders.instrumentId,
    side: orders.side,
    status: orders.status,
    quantity: orders.quantity,
    grossValue: orders.grossValue,
    fee: orders.fee,
    executedAt: orders.executedAt,
  }).from(orders).where(eq(orders.accountId, accountId)).orderBy(asc(orders.executedAt), asc(orders.id));
  const openByInstrument = new Map<string, Array<{ id: string; eventId: string; openedAt: Date; remainingQuantity: Decimal; adjustedCost: Decimal }>>();

  for (const order of history) {
    if (order.status !== 'filled' || order.instrumentId === null || order.executedAt === null) continue;
    const quantity = new Decimal(order.quantity);
    const grossValue = new Decimal(order.grossValue);
    const fee = new Decimal(order.fee);
    if (quantity.lessThanOrEqualTo(0)) {
      await db.insert(reconciliationIssues).values({
        accountId,
        syncRunId,
        issueType: 'invalid_order_quantity',
        severity: 'error',
        status: 'open',
        evidence: { orderId: order.id },
        observedAt,
      });
      continue;
    }
    const openLots = openByInstrument.get(order.instrumentId) ?? [];
    if (order.side === 'buy') {
      const adjustedCost = grossValue.plus(fee);
      const [lot] = await db.insert(lots).values({
        accountId,
        instrumentId: order.instrumentId,
        openingOrderId: order.id,
        openedAt: order.executedAt,
        originalQuantity: quantity.toFixed(),
        remainingQuantity: quantity.toFixed(),
        adjustedCost: adjustedCost.toFixed(),
        accountCurrency: currency,
        costKnown: true,
        policyVersion: FIFO_POLICY_VERSION,
        observedAt,
      }).returning({ id: lots.id });
      if (lot === undefined) throw new Error('Could not create FIFO lot.');
      openLots.push({ id: lot.id, eventId: order.id, openedAt: order.executedAt, remainingQuantity: quantity, adjustedCost });
      openByInstrument.set(order.instrumentId, openLots);
      continue;
    }
    if (order.side !== 'sell') continue;
    const netProceeds = grossValue.minus(fee);
    try {
      const allocations = allocateFifoSale(openLots, { id: order.id, executedAt: order.executedAt, quantity, netProceeds });
      for (const allocation of allocations) {
        await db.insert(lotDisposals).values({
          lotId: allocation.lotId,
          saleOrderId: order.id,
          quantity: allocation.quantity.toFixed(),
          adjustedCost: allocation.adjustedCost.toFixed(),
          netProceeds: allocation.netProceeds.toFixed(),
          realizedPnl: allocation.realizedPnl.toFixed(),
          policyVersion: FIFO_POLICY_VERSION,
        });
        const lot = openLots.find((candidate) => candidate.id === allocation.lotId);
        if (lot === undefined) throw new Error('FIFO allocation references a missing lot.');
        lot.remainingQuantity = lot.remainingQuantity.minus(allocation.quantity);
        lot.adjustedCost = lot.adjustedCost.minus(allocation.adjustedCost);
        await db.update(lots).set({ remainingQuantity: lot.remainingQuantity.toFixed(), adjustedCost: lot.adjustedCost.toFixed(), observedAt }).where(eq(lots.id, lot.id));
      }
    } catch (error) {
      await db.insert(reconciliationIssues).values({
        accountId,
        syncRunId,
        issueType: 'quantity_mismatch',
        severity: 'error',
        status: 'open',
        evidence: { orderId: order.id, reason: error instanceof Error ? error.message : 'FIFO allocation failed.' },
        observedAt,
      });
    }
  }
}

async function recordMaterialIssue(
  db: DrizzleDatabase,
  input: { accountId: string; syncRunId: string; issueType: string; expected: Decimal; actual: Decimal; currency: string; observedAt: Date; evidence: Record<string, unknown> },
): Promise<void> {
  const difference = input.actual.minus(input.expected);
  if (difference.abs().lessThanOrEqualTo(RECONCILIATION_TOLERANCE)) return;
  await db.insert(reconciliationIssues).values({
    accountId: input.accountId,
    syncRunId: input.syncRunId,
    issueType: input.issueType,
    severity: 'error',
    expectedValue: input.expected.toFixed(),
    actualValue: input.actual.toFixed(),
    difference: difference.toFixed(),
    accountCurrency: input.currency,
    status: 'open',
    evidence: input.evidence,
    observedAt: input.observedAt,
  });
}

async function reconcileAccount(db: DrizzleDatabase, accountId: string, syncRunId: string, summary: Summary): Promise<void> {
  await recordMaterialIssue(db, {
    accountId,
    syncRunId,
    issueType: 'nav_components_mismatch',
    expected: new Decimal(summary.cashValue).plus(summary.investedValue),
    actual: new Decimal(summary.totalValue),
    currency: summary.currency,
    observedAt: summary.observedAt,
    evidence: { check: 'total_value_equals_cash_plus_invested' },
  });

  const snapshots = await db.select({ id: accountSnapshots.id, cashValue: accountSnapshots.cashValue, observedAt: accountSnapshots.observedAt })
    .from(accountSnapshots).where(eq(accountSnapshots.accountId, accountId)).orderBy(asc(accountSnapshots.observedAt));
  if (snapshots.length >= 2) {
    const previous = snapshots.at(-2);
    if (previous !== undefined) {
      const cash = await db.select({ type: cashTransactions.transactionType, amount: cashTransactions.amountAccountCurrency })
        .from(cashTransactions)
        .where(and(eq(cashTransactions.accountId, accountId), gt(cashTransactions.occurredAt, previous.observedAt), lte(cashTransactions.occurredAt, summary.observedAt)));
      const orderHistory = await db.select({ side: orders.side, gross: orders.grossValue, fee: orders.fee })
        .from(orders)
        .where(and(eq(orders.accountId, accountId), gt(orders.executedAt, previous.observedAt), lte(orders.executedAt, summary.observedAt)));
      const income = await db.select({ net: dividends.netAmount }).from(dividends)
        .where(and(eq(dividends.accountId, accountId), gt(dividends.paidAt, previous.observedAt), lte(dividends.paidAt, summary.observedAt)));
      let expected = new Decimal(previous.cashValue);
      for (const transaction of cash) {
        const amount = new Decimal(transaction.amount).abs();
        if (transaction.type === 'deposit') expected = expected.plus(amount);
        if (transaction.type === 'withdrawal' || transaction.type === 'fee' || transaction.type === 'tax') expected = expected.minus(amount);
        if (transaction.type === 'interest') expected = expected.plus(amount);
      }
      for (const order of orderHistory) {
        const value = new Decimal(order.gross);
        const fee = new Decimal(order.fee);
        expected = order.side === 'buy' ? expected.minus(value.plus(fee)) : expected.plus(value.minus(fee));
      }
      for (const dividend of income) expected = expected.plus(new Decimal(dividend.net));
      await recordMaterialIssue(db, {
        accountId,
        syncRunId,
        issueType: 'cash_reconciliation_mismatch',
        expected,
        actual: new Decimal(summary.cashValue),
        currency: summary.currency,
        observedAt: summary.observedAt,
        evidence: { previousSnapshotId: previous.id },
      });
    }
  }

  const [latestSnapshot] = await db.select({ id: accountSnapshots.id })
    .from(accountSnapshots)
    .where(eq(accountSnapshots.accountId, accountId))
    .orderBy(desc(accountSnapshots.observedAt))
    .limit(1);
  if (latestSnapshot === undefined) return;
  const brokerPositions = await db.select({ instrumentId: positionSnapshots.instrumentId, quantity: positionSnapshots.quantity })
    .from(positionSnapshots)
    .where(eq(positionSnapshots.accountSnapshotId, latestSnapshot.id));
  const openLots = await db.select({ instrumentId: lots.instrumentId, quantity: lots.remainingQuantity })
    .from(lots).where(eq(lots.accountId, accountId));
  const expectedByInstrument = new Map<string, Decimal>();
  const actualByInstrument = new Map<string, Decimal>();
  for (const lot of openLots) {
    expectedByInstrument.set(lot.instrumentId, (expectedByInstrument.get(lot.instrumentId) ?? new Decimal(0)).plus(lot.quantity));
  }
  for (const position of brokerPositions) {
    actualByInstrument.set(position.instrumentId, (actualByInstrument.get(position.instrumentId) ?? new Decimal(0)).plus(position.quantity));
  }
  const instrumentIds = new Set([...expectedByInstrument.keys(), ...actualByInstrument.keys()]);
  for (const instrumentId of instrumentIds) {
    const expected = expectedByInstrument.get(instrumentId) ?? new Decimal(0);
    const actual = actualByInstrument.get(instrumentId) ?? new Decimal(0);
    const difference = actual.minus(expected);
    if (difference.abs().lessThanOrEqualTo(new Decimal('0.00000001'))) continue;
    await db.insert(reconciliationIssues).values({
      accountId,
      syncRunId,
      issueType: 'position_quantity_mismatch',
      severity: 'error',
      expectedValue: expected.toFixed(),
      actualValue: actual.toFixed(),
      difference: difference.toFixed(),
      status: 'open',
      evidence: { snapshotId: latestSnapshot.id, instrumentId },
      observedAt: summary.observedAt,
    });
  }
}

async function ingestStream(
  accountId: string,
  stream: 'orders' | 'transactions' | 'dividends',
  list: (nextPagePath?: string) => Promise<ProviderHistoryPage>,
  db: DrizzleDatabase,
  observedAt: Date,
  resumeCursor?: string,
): Promise<IngestionCounters & { pageCount: number }> {
  const counters: IngestionCounters & { pageCount: number } = { created: 0, ignored: 0, unknown: 0, pageCount: 0 };
  let nextPagePath = resumeCursor;
  do {
    const page = await list(nextPagePath);
    if (!Array.isArray(page.items) || (page.nextPagePath !== null && typeof page.nextPagePath !== 'string')) {
      throw new Error('Provider history page is invalid.');
    }
    const imported = await ingestPage({
      source: `trading212:${stream}`,
      stream,
      accountId,
      items: page.items,
      observedAt,
      checkpoint: { cursor: page.nextPagePath, watermark: observedAt },
    }, { db });
    counters.created += imported.created;
    counters.ignored += imported.ignored;
    counters.unknown += imported.unknown;
    counters.pageCount += 1;
    nextPagePath = page.nextPagePath ?? undefined;
  } while (nextPagePath !== undefined);
  return counters;
}

/** Runs only allowlisted read streams; it is safe to call repeatedly. */
export async function syncAccount(accountId: string, trigger: 'manual', options: SyncOptions): Promise<SyncResult> {
  const db = options.db ?? getDb();
  const now = options.now ?? (() => new Date());
  const owner = options.owner ?? randomUUID();
  const lease = await acquireLease(accountId, owner, { db, now: now() });
  const empty = { trigger, created: 0, ignored: 0, unknown: 0, pageCount: 0 } as const;
  if (!lease.acquired) return { status: 'skipped', ...empty };

  let runId: string | undefined;
  try {
    const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (account === undefined) return { status: 'failed', safeErrorCode: 'account_not_found', ...empty };
    const startedAt = now();
    const [run] = await db.insert(syncRuns).values({ accountId, trigger, status: 'running', startedAt }).returning({ id: syncRuns.id });
    if (run === undefined) throw new Error('Could not create sync run.');
    runId = run.id;

    const observedAt = now();
    const [summaryValue, positionsValue] = await Promise.all([options.client.getSummary(), options.client.getPositions()]);
    const summary = parseSummary(summaryValue, observedAt);
    await persistSnapshot(db, accountId, run.id, summary, positionsValue, observedAt);
    // Process provider streams serially. Cursor pages are sequential within a
    // stream too, so a sync cannot accidentally multiply API-rate pressure.
    const resumeCheckpoints = await db.select({ stream: syncCheckpoints.stream, cursor: syncCheckpoints.cursor })
      .from(syncCheckpoints).where(eq(syncCheckpoints.accountId, accountId));
    const cursorFor = (stream: string) => resumeCheckpoints.find((checkpoint) => checkpoint.stream === stream)?.cursor ?? undefined;
    const streams = [
      await ingestStream(accountId, 'orders', options.client.listOrders, db, observedAt, cursorFor('orders')),
      await ingestStream(accountId, 'transactions', options.client.listTransactions, db, observedAt, cursorFor('transactions')),
      await ingestStream(accountId, 'dividends', options.client.listDividends, db, observedAt, cursorFor('dividends')),
    ];
    const counters = streams.reduce((total, current) => ({
      created: total.created + current.created,
      ignored: total.ignored + current.ignored,
      unknown: total.unknown + current.unknown,
      pageCount: total.pageCount + current.pageCount,
    }), { created: 0, ignored: 0, unknown: 0, pageCount: 0 });
    const hasAccountingErrors = await db.transaction(async (tx) => {
      await rebuildLots(tx as DrizzleDatabase, accountId, run.id, observedAt, summary.currency);
      await reconcileAccount(tx as DrizzleDatabase, accountId, run.id, summary);
      const [errorIssue] = await tx.select({ id: reconciliationIssues.id }).from(reconciliationIssues)
        .where(and(eq(reconciliationIssues.accountId, accountId), eq(reconciliationIssues.syncRunId, run.id), eq(reconciliationIssues.severity, 'error')))
        .limit(1);
      const status = counters.unknown > 0 || errorIssue !== undefined ? 'partial' : 'succeeded';
      await tx.update(syncRuns).set({
        status,
        completedAt: now(),
        pageCount: counters.pageCount,
        createdCount: counters.created,
        ignoredCount: counters.ignored,
        watermark: observedAt,
      }).where(eq(syncRuns.id, run.id));
      return errorIssue !== undefined;
    });
    return { status: counters.unknown > 0 || hasAccountingErrors ? 'partial' : 'succeeded', trigger, ...counters };
  } catch (error) {
    const safeErrorCode = error instanceof Error && /Provider (summary|positions|history page)/.test(error.message)
      ? 'provider_response_invalid'
      : 'provider_request_failed';
    if (runId !== undefined) {
      await db.update(syncRuns).set({ status: 'failed', completedAt: now(), safeErrorCode }).where(eq(syncRuns.id, runId));
    }
    return { status: 'failed', safeErrorCode, ...empty };
  } finally {
    await releaseLease(accountId, owner, db);
  }
}

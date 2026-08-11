import postgres from 'postgres';
import Decimal from 'decimal.js';
import { describe, expect, test } from 'vitest';

import { syncAccount, type SyncClient } from '../../src/server/sync/service';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseTest = databaseUrl.length > 0 ? test : test.skip;

async function createAccount(client: postgres.Sql): Promise<string> {
  const [account] = await client<{ id: string }[]>`
    insert into accounts (provider, external_account_id, environment, reporting_currency, reporting_timezone)
    values ('test', ${crypto.randomUUID()}, 'local', 'EUR', 'UTC')
    returning id
  `;
  if (account === undefined) throw new Error('Could not create test account.');
  return account.id;
}

function clientFor(summary: Record<string, unknown>, orders: Record<string, unknown>[] = []): SyncClient {
  return {
    getSummary: async () => summary,
    getPositions: async () => [],
    listOrders: async () => ({ items: orders, nextPagePath: null }),
    listTransactions: async () => ({ items: [], nextPagePath: null }),
    listDividends: async () => ({ items: [], nextPagePath: null }),
  };
}

describe('transactional account synchronization', () => {
  databaseTest('skips a concurrent manual request without starting a second run', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);
    let releaseSummary: (() => void) | undefined;
    let markSummaryStarted: (() => void) | undefined;
    const summaryStarted = new Promise<void>((resolve) => { markSummaryStarted = resolve; });
    const blockingClient: SyncClient = {
      ...clientFor({ cashValue: '10', investedValue: '0', totalValue: '10', currency: 'EUR' }),
      getSummary: () => new Promise((resolve) => {
        releaseSummary = () => resolve({ cashValue: '10', investedValue: '0', totalValue: '10', currency: 'EUR' });
        markSummaryStarted?.();
      }),
    };

    try {
      const first = syncAccount(accountId, 'manual', { client: blockingClient });
      await summaryStarted;
      const second = await syncAccount(accountId, 'manual', { client: blockingClient });
      releaseSummary?.();

      expect(second.status).toBe('skipped');
      expect((await first).status).toBe('succeeded');
      const [runCount] = await client<{ count: string }[]>`select count(*) from sync_runs where account_id = ${accountId}`;
      expect(runCount?.count).toBe('1');
    } finally {
      await client.end();
    }
  });

  databaseTest('rebuilds FIFO lots and surfaces a material NAV reconciliation mismatch', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);
    const suffix = crypto.randomUUID();
    const tradingClient = clientFor(
      { cashValue: '10', investedValue: '20', totalValue: '100', currency: 'EUR', observedAt: '2026-02-01T12:00:00Z' },
      [
        { id: `buy-${suffix}`, type: 'buy', instrumentId: `instrument-${suffix}`, ticker: 'TST', quantity: '1.5', price: '10', fee: '1', currency: 'EUR', occurredAt: '2026-01-01T00:00:00Z' },
        { id: `sell-${suffix}`, type: 'sell', instrumentId: `instrument-${suffix}`, ticker: 'TST', quantity: '0.5', price: '20', fee: '1', currency: 'EUR', occurredAt: '2026-01-02T00:00:00Z' },
      ],
    );

    try {
      const result = await syncAccount(accountId, 'manual', { client: tradingClient });
      const [lot] = await client<{ original_quantity: string; remaining_quantity: string; adjusted_cost: string }[]>`
        select original_quantity, remaining_quantity, adjusted_cost from lots where account_id = ${accountId}
      `;
      const [disposal] = await client<{ quantity: string; adjusted_cost: string; net_proceeds: string; realized_pnl: string }[]>`
        select quantity, adjusted_cost, net_proceeds, realized_pnl
        from lot_disposals where sale_order_id = (select id from orders where account_id = ${accountId} and external_id = ${`sell-${suffix}`})
      `;
      const [issues] = await client<{ count: string }[]>`
        select count(*) from reconciliation_issues where account_id = ${accountId} and issue_type = 'nav_components_mismatch'
      `;

      expect(result).toMatchObject({ status: 'partial', created: 2, ignored: 0 });
      expect(lot?.original_quantity).toBe('1.5');
      expect(lot?.remaining_quantity).toBe('1');
      expect(new Decimal(lot?.adjusted_cost ?? '0').equals(new Decimal('10.666666666666666667'))).toBe(true);
      expect(disposal?.quantity).toBe('0.5');
      expect(new Decimal(disposal?.adjusted_cost ?? '0').equals(new Decimal('5.3333333333333333333'))).toBe(true);
      expect(new Decimal(disposal?.net_proceeds ?? '0').equals(new Decimal('9'))).toBe(true);
      expect(new Decimal(disposal?.realized_pnl ?? '0').equals(new Decimal('3.6666666666666666667'))).toBe(true);
      expect(issues?.count).toBe('1');
    } finally {
      await client.end();
    }
  });

  databaseTest('persists cash and broker-quantity reconciliation issues without changing source facts', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);
    const suffix = crypto.randomUUID();
    const order = { id: `buy-${suffix}`, type: 'buy', instrumentId: `instrument-${suffix}`, ticker: 'QTY', quantity: '1', price: '10', currency: 'EUR', occurredAt: '2025-12-31T00:00:00Z' };
    const firstClient: SyncClient = {
      ...clientFor({ cashValue: '100', investedValue: '10', totalValue: '110', currency: 'EUR', observedAt: '2026-01-01T12:00:00Z' }, [order]),
      getPositions: async () => [{ instrumentId: `instrument-${suffix}`, ticker: 'QTY', quantity: '1', marketValue: '10' }],
    };
    const secondClient: SyncClient = {
      ...clientFor({ cashValue: '120', investedValue: '20', totalValue: '140', currency: 'EUR', observedAt: '2026-01-02T12:00:00Z' }, [order]),
      getPositions: async () => [{ instrumentId: `instrument-${suffix}`, ticker: 'QTY', quantity: '2', marketValue: '20' }],
    };

    try {
      await syncAccount(accountId, 'manual', { client: firstClient });
      await syncAccount(accountId, 'manual', { client: secondClient });
      const issues = await client<{ issue_type: string; count: string }[]>`
        select issue_type, count(*) from reconciliation_issues
        where account_id = ${accountId} and issue_type in ('cash_reconciliation_mismatch', 'position_quantity_mismatch')
        group by issue_type order by issue_type
      `;
      const [rawCount] = await client<{ count: string }[]>`select count(*) from raw_events where account_id = ${accountId}`;

      expect(issues).toEqual([
        { issue_type: 'cash_reconciliation_mismatch', count: '1' },
        { issue_type: 'position_quantity_mismatch', count: '1' },
      ]);
      expect(rawCount?.count).toBe('1');
    } finally {
      await client.end();
    }
  });

  databaseTest('marks a completed run partial when review is required', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);
    const reviewClient: SyncClient = {
      ...clientFor({ cashValue: '10', investedValue: '0', totalValue: '10', currency: 'EUR' }),
      listTransactions: async () => ({
        items: [{ id: crypto.randomUUID(), type: 'unrecognized cash event', amount: '1', currency: 'EUR', occurredAt: '2026-01-01T00:00:00Z' }],
        nextPagePath: null,
      }),
    };

    try {
      const result = await syncAccount(accountId, 'manual', { client: reviewClient });
      const [run] = await client<{ status: string }[]>`select status from sync_runs where account_id = ${accountId}`;

      expect(result.status).toBe('partial');
      expect(run?.status).toBe('partial');
    } finally {
      await client.end();
    }
  });

  databaseTest('resumes a failed paginated stream from its committed checkpoint', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);
    const firstEvent = { id: crypto.randomUUID(), type: 'deposit', amount: '10', currency: 'EUR', occurredAt: '2026-01-01T00:00:00Z' };
    const finalEvent = { id: crypto.randomUUID(), type: 'deposit', amount: '20', currency: 'EUR', occurredAt: '2026-01-02T00:00:00Z' };
    const clientAfterFailure: SyncClient = {
      ...clientFor({ cashValue: '30', investedValue: '0', totalValue: '30', currency: 'EUR' }),
      listTransactions: async (cursor) => {
        expect(cursor).toBe('/transactions/page-2');
        return { items: [finalEvent], nextPagePath: null };
      },
    };
    const failingClient: SyncClient = {
      ...clientFor({ cashValue: '10', investedValue: '0', totalValue: '10', currency: 'EUR' }),
      listTransactions: async (cursor) => cursor === undefined
        ? { items: [firstEvent], nextPagePath: '/transactions/page-2' }
        : { items: [null as never], nextPagePath: null },
    };

    try {
      expect((await syncAccount(accountId, 'manual', { client: failingClient })).status).toBe('failed');
      expect((await syncAccount(accountId, 'manual', { client: clientAfterFailure })).status).toBe('partial');
      const [count] = await client<{ count: string }[]>`select count(*) from raw_events where account_id = ${accountId}`;
      const [checkpoint] = await client<{ cursor: string | null }[]>`
        select cursor from sync_checkpoints where account_id = ${accountId} and stream = 'transactions'
      `;

      expect(count?.count).toBe('2');
      expect(checkpoint?.cursor).toBeNull();
    } finally {
      await client.end();
    }
  });

  databaseTest('rolls back a snapshot and every position when a later provider position is malformed', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);
    const atomicityClient: SyncClient = {
      ...clientFor({ cashValue: '10', investedValue: '20', totalValue: '30', currency: 'EUR' }),
      getPositions: async () => [
        { instrumentId: crypto.randomUUID(), ticker: 'VALID', quantity: '1', marketValue: '20' },
        null,
      ],
    };

    try {
      expect((await syncAccount(accountId, 'manual', { client: atomicityClient })).status).toBe('failed');
      const [counts] = await client<{ snapshots: string; positions: string; issues: string }[]>`
        select
          (select count(*) from account_snapshots where account_id = ${accountId}) as snapshots,
          (select count(*) from position_snapshots where account_id = ${accountId}) as positions,
          (select count(*) from reconciliation_issues where account_id = ${accountId}) as issues
      `;
      expect(counts).toEqual({ snapshots: '0', positions: '0', issues: '0' });
    } finally {
      await client.end();
    }
  });

  databaseTest('flags an open lot missing from the broker snapshot and marks the run partial', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);
    const suffix = crypto.randomUUID();
    const missingPositionClient = clientFor(
      { cashValue: '0', investedValue: '10', totalValue: '10', currency: 'EUR' },
      [{ id: `buy-${suffix}`, type: 'buy', instrumentId: `instrument-${suffix}`, ticker: 'MISSING', quantity: '1', price: '10', currency: 'EUR', occurredAt: '2026-01-01T00:00:00Z' }],
    );

    try {
      const result = await syncAccount(accountId, 'manual', { client: missingPositionClient });
      const [issue] = await client<{ expected_value: string; actual_value: string }[]>`
        select expected_value, actual_value from reconciliation_issues
        where account_id = ${accountId} and issue_type = 'position_quantity_mismatch'
      `;
      const [run] = await client<{ status: string }[]>`select status from sync_runs where account_id = ${accountId}`;

      expect(issue).toEqual({ expected_value: '1', actual_value: '0' });
      expect(result.status).toBe('partial');
      expect(run?.status).toBe('partial');
    } finally {
      await client.end();
    }
  });
});

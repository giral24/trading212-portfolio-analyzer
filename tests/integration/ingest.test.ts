import postgres from 'postgres';
import { describe, expect, test } from 'vitest';

import { ingestPage } from '../../src/server/import/ingest';

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

describe('Postgres-backed ingestion', () => {
  databaseTest('deduplicates repeated and overlapping pages while retaining provenance', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);
    const suffix = crypto.randomUUID();
    const page = {
      source: 'trading212:transactions',
      stream: 'transactions',
      accountId,
      observedAt: new Date('2026-01-08T12:00:00Z'),
      checkpoint: { cursor: '/api/v0/equity/history/transactions?cursor=next', watermark: new Date('2026-01-08T00:00:00Z') },
      items: [
        { id: `deposit-${suffix}`, type: 'deposit', amount: '100.00', currency: 'EUR', occurredAt: '2026-01-01T00:00:00Z' },
        { id: `mystery-${suffix}`, type: 'mystery cash adjustment', amount: '1.00', currency: 'EUR', occurredAt: '2026-01-02T00:00:00Z' },
      ],
    };

    try {
      const first = await ingestPage(page);
      const repeated = await ingestPage(page);
      const overlapping = await ingestPage({ ...page, items: [page.items[0]!] });
      const [counts] = await client<{ raw_events: string; import_sources: string; classifications: string; issues: string; checkpoints: string }[]>`
        select
          (select count(*) from raw_events where account_id = ${accountId}) as raw_events,
          (select count(*) from import_sources where account_id = ${accountId}) as import_sources,
          (select count(*) from classifications where account_id = ${accountId}) as classifications,
          (select count(*) from reconciliation_issues where account_id = ${accountId} and issue_type = 'unknown_event') as issues,
          (select count(*) from sync_checkpoints where account_id = ${accountId} and stream = 'transactions') as checkpoints
      `;

      expect(first).toMatchObject({ created: 2, ignored: 0, unknown: 1 });
      expect(repeated).toMatchObject({ created: 0, ignored: 2, unknown: 0 });
      expect(overlapping).toMatchObject({ created: 0, ignored: 1, unknown: 0 });
      expect(counts).toEqual({ raw_events: '2', import_sources: '1', classifications: '2', issues: '1', checkpoints: '1' });
    } finally {
      await client.end();
    }
  });

  databaseTest('does not advance a checkpoint when a page cannot be normalized', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const accountId = await createAccount(client);

    try {
      await expect(ingestPage({
        source: 'trading212:orders',
        stream: 'orders',
        accountId,
        checkpoint: { cursor: '/next', watermark: new Date('2026-01-10T00:00:00Z') },
        items: [null as never],
      })).rejects.toThrow('Provider event must be an object');

      const [counts] = await client<{ raw_events: string; checkpoints: string }[]>`
        select
          (select count(*) from raw_events where account_id = ${accountId}) as raw_events,
          (select count(*) from sync_checkpoints where account_id = ${accountId} and stream = 'orders') as checkpoints
      `;
      expect(counts).toEqual({ raw_events: '0', checkpoints: '0' });
    } finally {
      await client.end();
    }
  });
});

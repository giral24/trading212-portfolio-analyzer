import { getTableName } from 'drizzle-orm';
import postgres from 'postgres';
import { describe, expect, it, test } from 'vitest';

import { lots, manualAdjustments, rawEvents } from '../../src/db/schema';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseTest = databaseUrl.length > 0 ? test : test.skip;

describe('auditable Postgres schema', () => {
  it('declares the canonical raw event and FIFO lot tables', () => {
    expect(getTableName(rawEvents)).toBe('raw_events');
    expect(getTableName(lots)).toBe('lots');
    expect(getTableName(manualAdjustments)).toBe('manual_adjustments');
  });

  databaseTest('enforces raw-event identity and decimal storage in Postgres', async () => {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const indexes = await client<[{ indexdef: string }]>`
        select indexdef
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'raw_events'
      `;
      const numericColumns = await client<[{ table_name: string; column_name: string }]>`
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and data_type = 'numeric'
      `;
      const constraints = await client<[{ definition: string }]>`
        select pg_get_constraintdef(oid) as definition
        from pg_constraint
        where conrelid = 'lots'::regclass
      `;
      const columns = new Set(numericColumns.map((column) => `${column.table_name}.${column.column_name}`));

      expect(indexes.some(({ indexdef }) => indexdef.includes('(source, external_id)'))).toBe(true);
      for (const expectedColumn of [
        'cash_transactions.amount_account_currency',
        'orders.quantity',
        'dividends.net_amount',
        'account_snapshots.total_value',
        'position_snapshots.quantity',
        'lots.remaining_quantity',
        'lot_disposals.quantity',
      ]) {
        expect(columns.has(expectedColumn)).toBe(true);
      }
      expect(constraints.some(({ definition }) => /remaining_quantity.*>=/.test(definition))).toBe(true);
    } finally {
      await client.end();
    }
  });

  databaseTest('rejects duplicate source events, negative lots, and reversal deletion', async () => {
    const client = postgres(databaseUrl, { max: 1 });
    const suffix = crypto.randomUUID();
    let accountId: string | undefined;
    let originalAdjustmentId: string | undefined;
    let reversalAdjustmentId: string | undefined;

    try {
      const [account] = await client<{ id: string }[]>`
        insert into accounts (provider, external_account_id, environment, reporting_currency, reporting_timezone)
        values ('test', ${suffix}, 'local', 'EUR', 'UTC')
        returning id
      `;
      accountId = account?.id;
      const [instrument] = await client<{ id: string }[]>`
        insert into instruments (provider, external_instrument_id, ticker)
        values ('test', ${suffix}, 'TEST')
        returning id
      `;

      await client`
        insert into raw_events (account_id, source, external_id, canonical_hash, observed_at, raw_payload)
        values (${accountId}, 'test', ${suffix}, ${`${suffix}-first`}, now(), '{}'::jsonb)
      `;
      await expect(client`
        insert into raw_events (account_id, source, external_id, canonical_hash, observed_at, raw_payload)
        values (${accountId}, 'test', ${suffix}, ${`${suffix}-duplicate`}, now(), '{}'::jsonb)
      `).rejects.toThrow();
      await expect(client`
        insert into lots (account_id, instrument_id, opened_at, original_quantity, remaining_quantity, adjusted_cost, account_currency, policy_version, observed_at)
        values (${accountId}, ${instrument?.id}, now(), 1, -0.01, 1, 'EUR', 'fifo-v1', now())
      `).rejects.toThrow();

      const [original] = await client<{ id: string }[]>`
        insert into manual_adjustments (account_id, adjustment_type, reason, evidence_reference, actor, observed_at)
        values (${accountId}, 'classification', 'test', 'test', 'test', now())
        returning id
      `;
      originalAdjustmentId = original?.id;
      const [reversal] = await client<{ id: string }[]>`
        insert into manual_adjustments (account_id, reversal_of_id, adjustment_type, reason, evidence_reference, actor, observed_at)
        values (${accountId}, ${originalAdjustmentId}, 'reversal', 'test', 'test', 'test', now())
        returning id
      `;
      reversalAdjustmentId = reversal?.id;

      await expect(client`delete from manual_adjustments where id = ${originalAdjustmentId}`).rejects.toThrow();
    } finally {
      if (reversalAdjustmentId !== undefined) {
        await client`delete from manual_adjustments where id = ${reversalAdjustmentId}`;
      }
      if (originalAdjustmentId !== undefined) {
        await client`delete from manual_adjustments where id = ${originalAdjustmentId}`;
      }
      if (accountId !== undefined) {
        await client`delete from accounts where id = ${accountId}`;
      }
      await client.end();
    }
  });
});

import { getTableName } from 'drizzle-orm';
import postgres from 'postgres';
import { describe, expect, it, test } from 'vitest';

import { lots, rawEvents } from '../../src/db/schema';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseTest = databaseUrl.length > 0 ? test : test.skip;

describe('auditable Postgres schema', () => {
  it('declares the canonical raw event and FIFO lot tables', () => {
    expect(getTableName(rawEvents)).toBe('raw_events');
    expect(getTableName(lots)).toBe('lots');
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
});

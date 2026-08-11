import { describe, expect, it } from 'vitest';

import { ingestPage } from '../../src/server/import/ingest';

describe('idempotent ingestion', () => {
  it('does not create another raw event when importing a page twice', async () => {
    const page = { source: 'test', accountId: 'account', items: [{ id: 'same', type: 'unknown' }] };
    const first = await ingestPage(page);
    const second = await ingestPage(page);

    expect(first.created).toBe(1);
    expect(second.ignored).toBe(1);
  });
});

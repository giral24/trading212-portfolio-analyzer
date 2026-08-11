import { describe, expect, it } from 'vitest';

import { acquireLease } from '../../src/server/sync/lease';

describe('manual account synchronization', () => {
  it('skips a concurrent manual synchronization lease', async () => {
    const first = await acquireLease('account', 'first');
    const second = await acquireLease('account', 'second');

    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
  });
});

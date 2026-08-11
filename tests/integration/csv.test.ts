import { describe, expect, it } from 'vitest';

import { parseTrading212Csv } from '../../src/server/import/csv';

describe('CSV import boundary', () => {
  it('preserves quoted provider values and rejects malformed row widths', () => {
    expect(parseTrading212Csv('id,type,note\n1,deposit,"quoted, value"\n')).toEqual([
      { id: '1', type: 'deposit', note: 'quoted, value' },
    ]);
    expect(() => parseTrading212Csv('id,type\n1,deposit,extra\n')).toThrow('expected 2 columns');
  });
});

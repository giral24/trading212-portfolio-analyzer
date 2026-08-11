import { describe, expect, it } from 'vitest';

import { createMoney, decimal } from '../../src/domain/money';

describe('money values', () => {
  it('creates a decimal monetary value with an explicit ISO currency', () => {
    const value = createMoney('12.34', 'EUR');

    expect(decimal(value.amount).equals('12.34')).toBe(true);
    expect(value.currency).toBe('EUR');
  });

  it('rejects an implicit numeric money value and invalid currency', () => {
    expect(() => decimal(12 as never)).toThrow();
    expect(() => createMoney('12.34', 'eur')).toThrow();
  });
});

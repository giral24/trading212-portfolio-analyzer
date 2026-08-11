import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  calculateModifiedDietz,
  calculateTotalInvestmentResult,
  calculateTrueTimeWeightedReturn,
  calculateXirr,
} from '../../src/domain/returns';
import type { ExternalFlow } from '../../src/domain/types';

describe('portfolio returns', () => {
  it('keeps a €200 to €220 gain when proceeds are reinvested', () => {
    const result = calculateTotalInvestmentResult({
      startValue: new Decimal('200'),
      endValue: new Decimal('220'),
      externalFlows: [],
    });

    expect(result.equals('20')).toBe(true);
  });

  it('calculates Modified Dietz for a mid-month €500 deposit', () => {
    const flows: ExternalFlow[] = [{ occurredAt: new Date('2025-01-16T00:00:00.000Z'), amount: new Decimal('500') }];

    const result = calculateModifiedDietz({
      startValue: new Decimal('1000'),
      endValue: new Decimal('1650'),
      externalFlows: flows,
      periodStart: new Date('2025-01-01T00:00:00.000Z'),
      periodEnd: new Date('2025-01-31T00:00:00.000Z'),
    });

    expect(result?.equals('0.12')).toBe(true);
  });

  it('calculates annual XIRR from a dated deposit and ending NAV', () => {
    const result = calculateXirr([
      { occurredAt: new Date('2025-01-01T00:00:00.000Z'), amount: new Decimal('-1000') },
      { occurredAt: new Date('2026-01-01T00:00:00.000Z'), amount: new Decimal('1100') },
    ]);

    expect(result?.toDecimalPlaces(8).equals('0.1')).toBe(true);
  });

  it('withholds TWR when a flow-boundary valuation is missing', () => {
    const result = calculateTrueTimeWeightedReturn([
      { startValue: new Decimal('1000'), endValue: new Decimal('1100') },
      { startValue: null, endValue: new Decimal('1200') },
    ]);

    expect(result).toBeNull();
  });
});

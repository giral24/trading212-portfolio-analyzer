import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  calculateNetContributions,
  reconcileCash,
  reconcileNav,
  reconcilePositionQuantity,
} from '../../src/domain/reconciliation';
import type { ExternalFlow } from '../../src/domain/types';

describe('portfolio reconciliation', () => {
  it('does not count imported buy and sale activity as net contributions', () => {
    const externalFlows: ExternalFlow[] = [{ occurredAt: new Date('2025-01-01T00:00:00.000Z'), amount: new Decimal('200'), perspective: 'portfolio' }];

    const netContributions = calculateNetContributions(externalFlows);
    const cash = reconcileCash({
      startCash: new Decimal('0'),
      endCash: new Decimal('220'),
      deposits: new Decimal('200'),
      withdrawals: new Decimal('0'),
      buys: new Decimal('200'),
      sales: new Decimal('220'),
      netDividends: new Decimal('0'),
      netInterest: new Decimal('0'),
      fees: new Decimal('0'),
      taxes: new Decimal('0'),
      adjustments: new Decimal('0'),
    });

    expect(netContributions.equals('200')).toBe(true);
    expect(cash.difference.isZero()).toBe(true);
  });

  it('reconciles fractional position quantity after a partial sale', () => {
    const result = reconcilePositionQuantity({
      startQuantity: new Decimal('0'),
      endQuantity: new Decimal('0.25'),
      buys: new Decimal('1.5'),
      sells: new Decimal('1.25'),
      corporateActions: new Decimal('0'),
      transfers: new Decimal('0'),
    });

    expect(result.difference.isZero()).toBe(true);
  });

  it('reconciles NAV after a €500 monthly deposit and investment result', () => {
    const result = reconcileNav({
      startNav: new Decimal('1000'),
      endNav: new Decimal('1650'),
      netExternalFlows: new Decimal('500'),
      reportedResult: new Decimal('150'),
    });

    expect(result.difference.isZero()).toBe(true);
  });
});

import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  annualizeReturn,
  calculateModifiedDietz,
  calculateTotalInvestmentResult,
  calculateTrueTimeWeightedReturn,
  calculateXirr,
  toInvestorCashFlows,
} from '../../src/domain/returns';
import type { ExternalFlow, InvestorCashFlow } from '../../src/domain/types';

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
    const flows: ExternalFlow[] = [{ occurredAt: new Date('2025-01-16T00:00:00.000Z'), amount: new Decimal('500'), perspective: 'portfolio' }];

    const result = calculateModifiedDietz({
      startValue: new Decimal('1000'),
      endValue: new Decimal('1650'),
      externalFlows: flows,
      periodStart: new Date('2025-01-01T00:00:00.000Z'),
      periodEnd: new Date('2025-01-31T00:00:00.000Z'),
    });

    expect(result?.equals('0.12')).toBe(true);
  });

  it('converts portfolio deposits and withdrawals to the investor XIRR convention', () => {
    const portfolioFlows: ExternalFlow[] = [
      { occurredAt: new Date('2025-01-01T00:00:00.000Z'), amount: new Decimal('1000'), perspective: 'portfolio' },
      { occurredAt: new Date('2026-01-01T00:00:00.000Z'), amount: new Decimal('-1100'), perspective: 'portfolio' },
    ];

    const investorFlows = toInvestorCashFlows(portfolioFlows);

    expect(investorFlows.map((flow) => flow.amount.toString())).toEqual(['-1000', '1100']);
    expect(investorFlows.every((flow) => flow.perspective === 'investor')).toBe(true);
    expect(calculateXirr(investorFlows)?.toDecimalPlaces(8).equals('0.1')).toBe(true);
  });

  it('accepts only explicitly investor-perspective flows for XIRR', () => {
    const flows: InvestorCashFlow[] = [
      { occurredAt: new Date('2025-01-01T00:00:00.000Z'), amount: new Decimal('-1000'), perspective: 'investor' },
      { occurredAt: new Date('2026-01-01T00:00:00.000Z'), amount: new Decimal('1100'), perspective: 'investor' },
    ];

    const result = calculateXirr(flows);

    expect(result?.toDecimalPlaces(8).equals('0.1')).toBe(true);
  });

  it('withholds TWR when a flow-boundary valuation is missing', () => {
    const result = calculateTrueTimeWeightedReturn([
      { startValue: new Decimal('1000'), endValue: new Decimal('1100') },
      { startValue: null, endValue: new Decimal('1200') },
    ]);

    expect(result).toBeNull();
  });

  it('compounds true TWR across complete subperiods', () => {
    const result = calculateTrueTimeWeightedReturn([
      { startValue: new Decimal('100'), endValue: new Decimal('110') },
      { startValue: new Decimal('110'), endValue: new Decimal('121') },
    ]);

    expect(result?.equals('0.21')).toBe(true);
  });

  it('annualises only an eligible cumulative return', () => {
    expect(annualizeReturn(new Decimal('0.21'), new Decimal('365'))?.equals('0.21')).toBe(true);
    expect(annualizeReturn(new Decimal('0.21'), new Decimal('364'))).toBeNull();
  });

  it('weights a flow exactly at the period start as one in Modified Dietz', () => {
    const result = calculateModifiedDietz({
      startValue: new Decimal('1000'),
      endValue: new Decimal('1650'),
      externalFlows: [{ occurredAt: new Date('2025-01-01T00:00:00.000Z'), amount: new Decimal('500'), perspective: 'portfolio' }],
      periodStart: new Date('2025-01-01T00:00:00.000Z'),
      periodEnd: new Date('2025-01-31T00:00:00.000Z'),
    });

    expect(result?.equals('0.1')).toBe(true);
  });

  it('weights a flow exactly at the period end as zero in Modified Dietz', () => {
    const result = calculateModifiedDietz({
      startValue: new Decimal('1000'),
      endValue: new Decimal('1600'),
      externalFlows: [{ occurredAt: new Date('2025-01-31T00:00:00.000Z'), amount: new Decimal('500'), perspective: 'portfolio' }],
      periodStart: new Date('2025-01-01T00:00:00.000Z'),
      periodEnd: new Date('2025-01-31T00:00:00.000Z'),
    });

    expect(result?.equals('0.1')).toBe(true);
  });

  it('rejects a Modified Dietz flow outside the selected period', () => {
    const result = calculateModifiedDietz({
      startValue: new Decimal('1000'),
      endValue: new Decimal('1600'),
      externalFlows: [{ occurredAt: new Date('2024-12-31T23:59:59.999Z'), amount: new Decimal('500'), perspective: 'portfolio' }],
      periodStart: new Date('2025-01-01T00:00:00.000Z'),
      periodEnd: new Date('2025-01-31T00:00:00.000Z'),
    });

    expect(result).toBeNull();
  });

  it('withholds XIRR when cash flows have no root', () => {
    const flows: InvestorCashFlow[] = [
      { occurredAt: new Date('2025-01-01T00:00:00.000Z'), amount: new Decimal('-1000'), perspective: 'investor' },
      { occurredAt: new Date('2026-01-01T00:00:00.000Z'), amount: new Decimal('-100'), perspective: 'investor' },
    ];

    expect(calculateXirr(flows)).toBeNull();
  });

  it('withholds XIRR when more than one stable root exists', () => {
    const flows: InvestorCashFlow[] = [
      { occurredAt: new Date('2025-01-01T00:00:00.000Z'), amount: new Decimal('-100'), perspective: 'investor' },
      { occurredAt: new Date('2026-01-01T00:00:00.000Z'), amount: new Decimal('230'), perspective: 'investor' },
      { occurredAt: new Date('2027-01-01T00:00:00.000Z'), amount: new Decimal('-132'), perspective: 'investor' },
    ];

    expect(calculateXirr(flows)).toBeNull();
  });
});

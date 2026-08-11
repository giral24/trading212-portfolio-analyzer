import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { allocateFifoSale, calculateRealizedPnl, calculateUnrealizedPnl } from '../../src/domain/lots';
import type { OpenLot, Sale } from '../../src/domain/types';

describe('FIFO lot accounting', () => {
  it('allocates a fractional partial sale in FIFO order', () => {
    const lots: OpenLot[] = [
      {
        id: 'first',
        eventId: 'buy-1',
        openedAt: new Date('2025-01-01T00:00:00.000Z'),
        remainingQuantity: new Decimal('1.5'),
        adjustedCost: new Decimal('150'),
      },
      {
        id: 'second',
        eventId: 'buy-2',
        openedAt: new Date('2025-02-01T00:00:00.000Z'),
        remainingQuantity: new Decimal('1'),
        adjustedCost: new Decimal('120'),
      },
    ];
    const sale: Sale = {
      id: 'sell-1',
      executedAt: new Date('2025-03-01T00:00:00.000Z'),
      quantity: new Decimal('1.75'),
      netProceeds: new Decimal('210'),
    };

    const allocations = allocateFifoSale(lots, sale);

    expect(allocations).toHaveLength(2);
    expect(allocations[0]).toMatchObject({ lotId: 'first' });
    expect(allocations[0]?.quantity.equals('1.5')).toBe(true);
    expect(allocations[0]?.adjustedCost.equals('150')).toBe(true);
    expect(allocations[1]).toMatchObject({ lotId: 'second' });
    expect(allocations[1]?.quantity.equals('0.25')).toBe(true);
    expect(allocations[1]?.adjustedCost.equals('30')).toBe(true);
    expect(allocations.reduce((total, allocation) => total.plus(allocation.quantity), new Decimal('0')).equals(sale.quantity)).toBe(true);
  });

  it('includes buy and sale fees exactly once in realised profit', () => {
    const lot: OpenLot = {
      id: 'buy-1',
      eventId: 'buy-1',
      openedAt: new Date('2025-01-01T00:00:00.000Z'),
      remainingQuantity: new Decimal('1'),
      adjustedCost: new Decimal('201'),
    };
    const sale: Sale = {
      id: 'sell-1',
      executedAt: new Date('2025-02-01T00:00:00.000Z'),
      quantity: new Decimal('1'),
      netProceeds: new Decimal('219'),
    };

    const allocations = allocateFifoSale([lot], sale);

    expect(calculateRealizedPnl(allocations).equals('18')).toBe(true);
  });

  it('calculates unrealised profit from open-lot cost and snapshot value', () => {
    const result = calculateUnrealizedPnl({
      openLots: [
        {
          id: 'open',
          eventId: 'buy-1',
          openedAt: new Date('2025-01-01T00:00:00.000Z'),
          remainingQuantity: new Decimal('2'),
          adjustedCost: new Decimal('200'),
        },
      ],
      marketValue: new Decimal('220'),
    });

    expect(result?.equals('20')).toBe(true);
  });

  it('is deterministic when allocating the same sale repeatedly', () => {
    const lots: OpenLot[] = [
      {
        id: 'buy-1',
        eventId: 'buy-1',
        openedAt: new Date('2025-01-01T00:00:00.000Z'),
        remainingQuantity: new Decimal('2'),
        adjustedCost: new Decimal('200'),
      },
    ];
    const sale: Sale = {
      id: 'sell-1',
      executedAt: new Date('2025-02-01T00:00:00.000Z'),
      quantity: new Decimal('1'),
      netProceeds: new Decimal('120'),
    };

    expect(allocateFifoSale(lots, sale)).toEqual(allocateFifoSale(lots, sale));
  });
});

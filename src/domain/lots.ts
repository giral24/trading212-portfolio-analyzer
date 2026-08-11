import Decimal from 'decimal.js';

import type { DisposalAllocation, OpenLot, Sale, UnrealizedPnlInput } from './types';

const ZERO = new Decimal('0');

function assertPositive(value: Decimal, label: string): void {
  if (value.lessThanOrEqualTo(ZERO)) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

/**
 * Allocates a sell execution against immutable input lots using FIFO v1.
 * The caller persists remaining quantities only after the allocation is
 * committed with the sale, preserving deterministic recalculation.
 */
export function allocateFifoSale(lots: OpenLot[], sale: Sale): DisposalAllocation[] {
  assertPositive(sale.quantity, 'Sale quantity');

  const sortedLots = [...lots].sort((left, right) => {
    const openedAtDifference = left.openedAt.getTime() - right.openedAt.getTime();
    return openedAtDifference === 0 ? left.eventId.localeCompare(right.eventId) : openedAtDifference;
  });
  const availableQuantity = sortedLots.reduce((total, lot) => total.plus(lot.remainingQuantity), ZERO);

  if (availableQuantity.lessThan(sale.quantity)) {
    throw new Error('Sale quantity exceeds the available open-lot quantity.');
  }

  let remainingSaleQuantity = sale.quantity;
  const allocations: DisposalAllocation[] = [];

  for (const lot of sortedLots) {
    if (remainingSaleQuantity.isZero()) {
      break;
    }

    assertPositive(lot.remainingQuantity, `Lot ${lot.id} quantity`);
    const allocatedQuantity = Decimal.min(lot.remainingQuantity, remainingSaleQuantity);
    const allocationRatio = allocatedQuantity.div(lot.remainingQuantity);
    const adjustedCost = lot.adjustedCost.times(allocationRatio);
    const proceedsRatio = allocatedQuantity.div(sale.quantity);
    const netProceeds = sale.netProceeds.times(proceedsRatio);

    allocations.push({
      saleId: sale.id,
      lotId: lot.id,
      quantity: allocatedQuantity,
      adjustedCost,
      netProceeds,
      realizedPnl: netProceeds.minus(adjustedCost),
    });
    remainingSaleQuantity = remainingSaleQuantity.minus(allocatedQuantity);
  }

  return allocations;
}

export function calculateRealizedPnl(allocations: DisposalAllocation[]): Decimal {
  return allocations.reduce((total, allocation) => total.plus(allocation.realizedPnl), ZERO);
}

/** Returns null when the broker cannot provide a current, reliable market value. */
export function calculateUnrealizedPnl(input: UnrealizedPnlInput): Decimal | null {
  if (input.marketValue === null) {
    return null;
  }

  const openCost = input.openLots.reduce((total, lot) => total.plus(lot.adjustedCost), ZERO);
  return input.marketValue.minus(openCost);
}

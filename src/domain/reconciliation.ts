import Decimal from 'decimal.js';

import type {
  CashReconciliationInput,
  ExternalFlow,
  NavReconciliationInput,
  PositionReconciliationInput,
  ReconciliationResult,
} from './types';

const ZERO = new Decimal('0');

function result(expected: Decimal, actual: Decimal): ReconciliationResult {
  return {
    expected,
    actual,
    difference: actual.minus(expected),
  };
}

/** Sums only flows that cross the account boundary; orders are deliberately absent. */
export function calculateNetContributions(externalFlows: ExternalFlow[]): Decimal {
  return externalFlows.reduce((total, flow) => total.plus(flow.amount), ZERO);
}

export function reconcilePositionQuantity(input: PositionReconciliationInput): ReconciliationResult {
  const expected = input.startQuantity
    .plus(input.buys)
    .minus(input.sells)
    .plus(input.corporateActions)
    .plus(input.transfers);

  return result(expected, input.endQuantity);
}

export function reconcileCash(input: CashReconciliationInput): ReconciliationResult {
  const expected = input.startCash
    .plus(input.deposits)
    .minus(input.withdrawals)
    .minus(input.buys)
    .plus(input.sales)
    .plus(input.netDividends)
    .plus(input.netInterest)
    .minus(input.fees)
    .minus(input.taxes)
    .plus(input.adjustments);

  return result(expected, input.endCash);
}

export function reconcileNav(input: NavReconciliationInput): ReconciliationResult {
  const calculatedResult = input.endNav.minus(input.startNav).minus(input.netExternalFlows);
  return result(calculatedResult, input.reportedResult);
}

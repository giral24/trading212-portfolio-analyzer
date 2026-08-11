import type Decimal from 'decimal.js';

export type ExternalFlow = {
  occurredAt: Date;
  /** Positive when money enters the portfolio; negative when it leaves. */
  amount: Decimal;
};

export type DietzInput = {
  startValue: Decimal;
  endValue: Decimal;
  externalFlows: ExternalFlow[];
  periodStart: Date;
  periodEnd: Date;
};

export type TwrSubperiod = {
  startValue: Decimal | null;
  endValue: Decimal | null;
};

export type TotalInvestmentResultInput = {
  startValue: Decimal;
  endValue: Decimal;
  externalFlows: ExternalFlow[];
};

export type OpenLot = {
  id: string;
  eventId: string;
  openedAt: Date;
  /** Remaining quantity and cost are changed only by a future accounting rebuild. */
  remainingQuantity: Decimal;
  /** Total remaining cost, including capitalized buy fees. */
  adjustedCost: Decimal;
};

export type Sale = {
  id: string;
  executedAt: Date;
  quantity: Decimal;
  /** Proceeds after disposal fees and taxes. */
  netProceeds: Decimal;
};

export type DisposalAllocation = {
  saleId: string;
  lotId: string;
  quantity: Decimal;
  adjustedCost: Decimal;
  netProceeds: Decimal;
  realizedPnl: Decimal;
};

export type UnrealizedPnlInput = {
  openLots: OpenLot[];
  /** Null denotes an unavailable or stale broker valuation. */
  marketValue: Decimal | null;
};

export type PositionReconciliationInput = {
  startQuantity: Decimal;
  endQuantity: Decimal;
  buys: Decimal;
  sells: Decimal;
  corporateActions: Decimal;
  transfers: Decimal;
};

export type CashReconciliationInput = {
  startCash: Decimal;
  endCash: Decimal;
  deposits: Decimal;
  withdrawals: Decimal;
  buys: Decimal;
  sales: Decimal;
  netDividends: Decimal;
  netInterest: Decimal;
  fees: Decimal;
  taxes: Decimal;
  adjustments: Decimal;
};

export type NavReconciliationInput = {
  startNav: Decimal;
  endNav: Decimal;
  netExternalFlows: Decimal;
  reportedResult: Decimal;
};

export type ReconciliationResult = {
  expected: Decimal;
  actual: Decimal;
  difference: Decimal;
};

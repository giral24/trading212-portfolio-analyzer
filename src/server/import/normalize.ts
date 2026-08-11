import Decimal from 'decimal.js';

export type ProviderEvent = Record<string, unknown>;

export type NormalizedEventType =
  | 'deposit'
  | 'withdrawal'
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'interest'
  | 'fee'
  | 'tax'
  | 'internal_transfer'
  | 'corporate_action'
  | 'correction'
  | 'unknown';

export type NormalizedEvent = {
  externalId: string | null;
  type: NormalizedEventType;
  providerType: string | null;
  occurredAt: Date | null;
  amount: string | null;
  currency: string | null;
  quantity: string | null;
  price: string | null;
  fee: string | null;
  grossAmount: string | null;
  withheldAmount: string | null;
  netAmount: string | null;
  instrumentExternalId: string | null;
  ticker: string | null;
  status: string;
  raw: ProviderEvent;
};

function assertRecord(value: unknown): asserts value is ProviderEvent {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Provider event must be an object.');
  }
}

function firstString(event: ProviderEvent, keys: string[]): string | null {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function decimalString(value: string | null): string | null {
  if (value === null) return null;
  try {
    return new Decimal(value).toFixed();
  } catch {
    return null;
  }
}

function normalizeType(providerType: string | null): NormalizedEventType {
  const value = providerType?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  if (['deposit', 'cash_deposit', 'funds_in'].includes(value)) return 'deposit';
  if (['withdrawal', 'cash_withdrawal', 'funds_out'].includes(value)) return 'withdrawal';
  if (['buy', 'market_buy', 'limit_buy'].includes(value)) return 'buy';
  if (['sell', 'market_sell', 'limit_sell'].includes(value)) return 'sell';
  if (['dividend', 'cash_dividend'].includes(value)) return 'dividend';
  if (['interest', 'lending_interest'].includes(value)) return 'interest';
  if (['fee', 'commission'].includes(value)) return 'fee';
  if (['tax', 'withholding_tax'].includes(value)) return 'tax';
  if (['internal_transfer', 'transfer'].includes(value)) return 'internal_transfer';
  if (['corporate_action', 'split', 'reverse_split', 'merger', 'spinoff'].includes(value)) return 'corporate_action';
  if (['correction', 'reversal'].includes(value)) return 'correction';
  return 'unknown';
}

function dateValue(event: ProviderEvent): Date | null {
  const value = firstString(event, ['occurredAt', 'executedAt', 'paidAt', 'bookedAt', 'settledAt', 'date', 'timestamp']);
  if (value === null || Number.isNaN(Date.parse(value))) return null;
  return new Date(value);
}

/**
 * Maps only well-known semantic labels. Fields remain nullable so incomplete
 * provider records can enter the review queue instead of being invented.
 */
export function normalizeEvent(value: unknown): NormalizedEvent {
  assertRecord(value);
  const providerType = firstString(value, ['type', 'transactionType', 'orderType', 'eventType']);
  const grossAmount = decimalString(firstString(value, ['grossAmount', 'grossValue', 'value', 'total']));
  const amount = decimalString(firstString(value, ['amount', 'value', 'netAmount', 'total']));
  const netAmount = decimalString(firstString(value, ['netAmount', 'amount', 'value']));

  return {
    externalId: firstString(value, ['id', 'transactionId', 'orderId', 'reference']),
    type: normalizeType(providerType),
    providerType,
    occurredAt: dateValue(value),
    amount,
    currency: firstString(value, ['accountCurrency', 'currency', 'currencyCode']),
    quantity: decimalString(firstString(value, ['quantity', 'filledQuantity', 'shares'])),
    price: decimalString(firstString(value, ['price', 'averagePrice', 'fillPrice'])),
    fee: decimalString(firstString(value, ['fee', 'commission', 'fees'])) ?? '0',
    grossAmount,
    withheldAmount: decimalString(firstString(value, ['withheldAmount', 'withholdingTax', 'tax'])) ?? '0',
    netAmount,
    instrumentExternalId: firstString(value, ['instrumentId', 'instrumentCode', 'isin', 'ticker']),
    ticker: firstString(value, ['ticker', 'symbol', 'instrumentCode']),
    status: firstString(value, ['status', 'orderStatus'])?.toLowerCase() ?? 'filled',
    raw: value,
  };
}

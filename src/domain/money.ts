import Decimal from 'decimal.js';

export type Money = {
  amount: string;
  currency: string;
};

const ISO_CURRENCY = /^[A-Z]{3}$/;

/**
 * Converts a persisted decimal string into the calculation representation.
 * Monetary callers must not pass JavaScript numbers, which would carry an
 * already-rounded binary value into the accounting domain.
 */
export function decimal(value: string): Decimal {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Money must be represented by a non-empty decimal string.');
  }

  const result = new Decimal(value);

  if (!result.isFinite()) {
    throw new Error('Money must be finite.');
  }

  return result;
}

export function createMoney(amount: string, currency: string): Money {
  if (!ISO_CURRENCY.test(currency)) {
    throw new Error('Currency must be a three-letter uppercase ISO code.');
  }

  return {
    amount: decimal(amount).toString(),
    currency,
  };
}

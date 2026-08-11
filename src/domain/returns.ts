import Decimal from 'decimal.js';

import type { DietzInput, ExternalFlow, InvestorCashFlow, TotalInvestmentResultInput, TwrSubperiod } from './types';

const ZERO = new Decimal('0');
const ONE = new Decimal('1');
const DAYS_PER_YEAR = new Decimal('365');
const MILLISECONDS_PER_DAY = new Decimal('86400000');

function sumFlows(flows: ExternalFlow[]): Decimal {
  return flows.reduce((total, flow) => total.plus(flow.amount), ZERO);
}

function dayOffset(from: Date, to: Date): Decimal | null {
  const milliseconds = to.getTime() - from.getTime();

  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return null;
  }

  return new Decimal(String(milliseconds)).div(MILLISECONDS_PER_DAY);
}

export function calculateTotalInvestmentResult(input: TotalInvestmentResultInput): Decimal {
  return input.endValue.minus(input.startValue).minus(sumFlows(input.externalFlows));
}

/**
 * Reverses the account perspective for investor-return calculations. An
 * account deposit is an investor outflow; an account withdrawal is an investor
 * inflow. XIRR accepts only this explicit convention.
 */
export function toInvestorCashFlows(externalFlows: ExternalFlow[]): InvestorCashFlow[] {
  return externalFlows.map((flow) => ({
    occurredAt: flow.occurredAt,
    amount: flow.amount.negated(),
    perspective: 'investor',
  }));
}

/** Returns null when period coverage cannot support the approximation. */
export function calculateModifiedDietz(input: DietzInput): Decimal | null {
  const periodDays = dayOffset(input.periodStart, input.periodEnd);

  if (periodDays === null || periodDays.isZero()) {
    return null;
  }

  let weightedFlows = ZERO;

  for (const flow of input.externalFlows) {
    const elapsedDays = dayOffset(input.periodStart, flow.occurredAt);

    if (elapsedDays === null || elapsedDays.greaterThan(periodDays)) {
      return null;
    }

    const weight = periodDays.minus(elapsedDays).div(periodDays);
    weightedFlows = weightedFlows.plus(weight.times(flow.amount));
  }

  const denominator = input.startValue.plus(weightedFlows);

  if (denominator.isZero()) {
    return null;
  }

  return input.endValue.minus(input.startValue).minus(sumFlows(input.externalFlows)).div(denominator);
}

/**
 * Multiplies already-separated subperiod returns. A missing boundary valuation
 * makes true TWR unavailable rather than estimating it.
 */
export function calculateTrueTimeWeightedReturn(subperiods: TwrSubperiod[]): Decimal | null {
  if (subperiods.length === 0) {
    return null;
  }

  let compounded = ONE;

  for (const subperiod of subperiods) {
    if (subperiod.startValue === null || subperiod.endValue === null || subperiod.startValue.lessThanOrEqualTo(ZERO)) {
      return null;
    }

    compounded = compounded.times(subperiod.endValue.div(subperiod.startValue));
  }

  return compounded.minus(ONE);
}

export function annualizeReturn(cumulativeReturn: Decimal, periodDays: Decimal): Decimal | null {
  if (periodDays.lessThan(DAYS_PER_YEAR) || cumulativeReturn.lessThanOrEqualTo(ONE.negated())) {
    return null;
  }

  return ONE.plus(cumulativeReturn).pow(DAYS_PER_YEAR.div(periodDays)).minus(ONE);
}

function netPresentValue(rate: Decimal, flows: InvestorCashFlow[], startDate: Date): Decimal | null {
  const base = ONE.plus(rate);

  if (base.lessThanOrEqualTo(ZERO)) {
    return null;
  }

  let result = ZERO;

  for (const flow of flows) {
    const days = dayOffset(startDate, flow.occurredAt);

    if (days === null) {
      return null;
    }

    const yearFraction = days.div(DAYS_PER_YEAR);
    result = result.plus(flow.amount.div(base.pow(yearFraction)));
  }

  return result;
}

function bisectXirr(lower: Decimal, upper: Decimal, flows: InvestorCashFlow[], startDate: Date): Decimal | null {
  let low = lower;
  let high = upper;
  let lowValue = netPresentValue(low, flows, startDate);
  const highValue = netPresentValue(high, flows, startDate);

  if (lowValue === null || highValue === null || lowValue.times(highValue).greaterThan(ZERO)) {
    return null;
  }

  for (let iteration = 0; iteration < 160; iteration += 1) {
    const middle = low.plus(high).div('2');
    const middleValue = netPresentValue(middle, flows, startDate);

    if (middleValue === null) {
      return null;
    }

    if (middleValue.abs().lessThan('0.000000000001')) {
      return middle;
    }

    if (lowValue.times(middleValue).lessThanOrEqualTo(ZERO)) {
      high = middle;
    } else {
      low = middle;
      lowValue = middleValue;
    }
  }

  return low.plus(high).div('2');
}

function xirrSearchRates(): Decimal[] {
  const negativeRates = ['-0.999999', '-0.99', '-0.9', '-0.75', '-0.5', '-0.25', '-0.1', '-0.05', '0'];
  const rates = negativeRates.map((rate) => new Decimal(rate));

  for (let basisPoint = 1; basisPoint <= 100; basisPoint += 1) {
    rates.push(new Decimal(String(basisPoint)).div('100'));
  }

  for (let tenth = 11; tenth <= 100; tenth += 1) {
    rates.push(new Decimal(String(tenth)).div('10'));
  }

  for (let whole = 11; whole <= 100; whole += 1) {
    rates.push(new Decimal(String(whole)));
  }

  return rates;
}

/**
 * Finds one numerically stable annual ACT/365 root. Multiple sign-change
 * brackets are ambiguous and therefore intentionally return null.
 */
export function calculateXirr(flows: InvestorCashFlow[]): Decimal | null {
  if (flows.length < 2) {
    return null;
  }

  const hasPositive = flows.some((flow) => flow.amount.greaterThan(ZERO));
  const hasNegative = flows.some((flow) => flow.amount.lessThan(ZERO));

  if (!hasPositive || !hasNegative) {
    return null;
  }

  const orderedFlows = [...flows].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  const startDate = orderedFlows[0]?.occurredAt;

  if (startDate === undefined || orderedFlows.some((flow) => Number.isNaN(flow.occurredAt.getTime()))) {
    return null;
  }

  const roots: Decimal[] = [];
  const rates = xirrSearchRates();

  for (let index = 0; index < rates.length - 1; index += 1) {
    const lower = rates[index];
    const upper = rates[index + 1];

    if (lower === undefined || upper === undefined) {
      continue;
    }

    const lowerValue = netPresentValue(lower, orderedFlows, startDate);
    const upperValue = netPresentValue(upper, orderedFlows, startDate);

    if (lowerValue === null || upperValue === null) {
      continue;
    }

    if (lowerValue.isZero()) {
      roots.push(lower);
      continue;
    }

    if (lowerValue.times(upperValue).lessThan(ZERO)) {
      const root = bisectXirr(lower, upper, orderedFlows, startDate);

      if (root !== null) {
        roots.push(root);
      }
    }
  }

  const uniqueRoots = roots.filter((root, index) => roots.slice(0, index).every((candidate) => candidate.minus(root).abs().greaterThan('0.00000001')));

  return uniqueRoots.length === 1 ? uniqueRoots[0] ?? null : null;
}

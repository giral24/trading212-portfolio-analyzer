# Metrics and Formulas

Read [the glossary](../00-foundations/02-decisions-and-glossary.md) first. This note is the authoritative calculation contract. It is not tax advice or a claim of GIPS compliance.

## Conventions

- `V0` and `V1` are total account values: cash plus open positions at a known timestamp.
- An external cash flow `CF` is positive when it enters the portfolio and negative when it leaves.
- Amounts are rounded only for display. Persist monetary values as decimals in their original currency and account currency.
- The account reporting timezone selects period boundaries. Source timestamps remain UTC.
- Transaction costs are included exactly once: buy costs increase lot cost; sale costs reduce net proceeds. Withholding is recorded independently from dividend gross amount.

## Monetary metrics

### Net contributions

`netContributions = deposits − withdrawals`

Purchases, sales, reinvested dividends, internal cash movements, and transfers between sub-portfolios are not deposits or withdrawals at consolidated-account level.

### Total investment result

For a period with reliable boundary valuations:

`totalResult = V1 − V0 − Σ externalCashFlows`

For the complete account from inception, this becomes:

`totalResult = currentTotalValue + withdrawals − deposits`

It captures market movement, FX, dividends, interest, fees, tax withholding, and corporate-action effects. It is an amount, not a return percentage.

### Realised result

For each sale allocation to one or more lots:

`realisedPnL = allocatedNetSaleProceeds − allocatedAdjustedCost`

`allocatedAdjustedCost` includes the matched opening cost and capitalized buy fees. `allocatedNetSaleProceeds` excludes sale fees and taxes charged on the disposal. The complete sale result is the sum of its allocations.

### Unrealised result

`unrealisedPnL = marketValue(openLots at snapshot) − adjustedCost(openLots)`

Use the broker snapshot price and time when available. A stale or unavailable price makes this metric unavailable, not zero.

### Income and costs bridge

The main result is net. An explanatory bridge may show:

`netResult = realisedPnL + unrealisedPnL + netDividends + netInterest + lendingIncome − nonCapitalizedFees − taxesNotAlreadyIncluded + adjustments`

Do not add a fee or withholding twice if it is already embedded in a lot cost, sale proceeds, or net dividend.

## Percentage metrics

### True time-weighted return (TWR)

TWR measures investment performance independently of deposit and withdrawal timing. Split the timeline at every external cash flow and value the portfolio immediately before/after it according to the declared end-of-day convention:

`rj = endValueBeforeFlow / startValueAfterPriorFlow − 1`

`TWR = Π(1 + rj) − 1`

Dividends, purchases, sales, internal reinvestment, and fees remain inside the portfolio return. True TWR requires a valuation at every relevant flow boundary. It is the preferred portfolio-performance metric when that condition is met. [GIPS handbook](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/).

### Modified Dietz (explicit approximation)

When only start/end valuation and dated flows exist:

`modifiedDietz = (V1 − V0 − ΣCF) / (V0 + Σ(wi × CFi))`

For an end-of-day flow, `wi = (periodDays − daysElapsedToFlow) / periodDays`. The UI calls this **Estimated return (Modified Dietz)**, never TWR. Its accuracy weakens with large intra-period flows and volatility. Flag a period for review when a flow exceeds 10% of its preceding valuation; the threshold is configurable and versioned.

### Money-weighted return (XIRR)

XIRR reports the annualised return experienced by the investor. Use cash flows from the investor perspective: deposits negative, withdrawals positive, and ending total value as a final positive hypothetical liquidation.

`Σ(CFi / (1 + r)^((datei − date0) / 365)) = 0`

It requires at least one positive and one negative flow. If numerical solving finds no stable unique solution, show `Not available — ambiguous cash-flow pattern`. Do not select an arbitrary root. XIRR already is annualised. [Microsoft XIRR reference](https://learn.microsoft.com/en-us/office/vba/api/excel.worksheetfunction.xirr).

### Annualisation

For cumulative TWR or Dietz `R` over `D` days, and only when `D >= 365`:

`annualisedReturn = (1 + R)^(365 / D) − 1`

Never annualise short periods or returns at/below -100%. The chosen day count is ACT/365 throughout the application.

## Metric availability matrix

| Metric | Minimum inputs | Withhold when |
|---|---|---|
| Current total value | Current account snapshot | Summary unavailable or stale beyond configured limit |
| Period P&L | Start/end valuations and classified flows | Either boundary valuation absent |
| Realised P&L | Complete trade history, lot policy, fees | Cost basis or corporate action unresolved |
| Unrealised P&L | Open lots and current priced snapshot | Quantity or price cannot reconcile |
| True TWR | Flow-boundary valuations | Any material flow lacks boundary valuation |
| Modified Dietz | Boundary valuations plus flow dates | Start/end valuation unavailable |
| XIRR | Deposits, withdrawals, ending value | Cash-flow signs or final value inadequate |

## User-facing labels

- `Resultado de inversión (€)` — monetary result after external flows.
- `Rentabilidad de cartera (TWR)` — only true TWR.
- `Rentabilidad estimada (Modified Dietz)` — approximate return.
- `Rentabilidad de tu dinero (XIRR anual)` — investor-specific annual return.
- `Cambio de valor` — raw value movement; always states whether it includes flows.

No label may say only “rentabilidad”, “ganancia” or “%” without its method and period.


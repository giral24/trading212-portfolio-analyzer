# Events, Lots, and Edge Cases

## Event classification

Every canonical event has a provider type, normalized business type, source timestamp(s), original amount/currency, account amount/currency, source reference, raw payload, and rule version.

| Normalized type | External flow? | Creates/changes a lot? | Notes |
|---|---:|---:|---|
| Deposit | Yes, positive | No | Investor money entering account |
| Withdrawal | Yes, negative | No | Investor money leaving account |
| Buy execution | No | Opens/increases lot | Fee capitalized once |
| Sell execution | No | Closes lots | Uses FIFO allocations |
| Dividend | No | No | Gross, withholding, net, payment date preserved |
| Interest / lending income | No | No | Income event, not a deposit |
| Fee / tax | No | Depends | Must state whether included in cost/proceeds |
| Internal transfer | No (account level) | Maybe | External only for a narrower sub-portfolio view |
| Corporate action | No | Transforms lots | Never silently creates P&L |
| Correction / reversal | Depends | Depends | Linked to original; append-only |
| Unknown | No until reviewed | No | Blocks affected metrics instead of guessing |

## Lot policy: FIFO v1

FIFO is the initial analysis policy, not tax advice. Order open lots by `executed_at`, then stable `event_id`; a sale consumes the oldest remaining quantity first. A partial sale splits an allocation but keeps the residual lot's original acquisition date and unit cost.

Each lot stores original and remaining quantity, adjusted total and unit cost, opening event, instrument identity, account currency values, and calculation policy version. Each disposal allocation stores the sale event, lot, quantity, assigned cost, assigned net proceeds, and realised P&L. A sale may allocate across many lots.

Alternative methods (average cost, LIFO, specific identification, HIFO) require a new complete calculation policy and a full rebuild; the system must never rewrite a historic FIFO result in place.

## Corporate actions and special events

- **Partial fills:** only filled executions affect cash, lots, or P&L. Cancelled and pending orders are operational records only.
- **Fractional shares:** quantity uses high precision; never coerce to integer.
- **Split / reverse split:** transform quantity and unit cost, preserve aggregate cost, create no realised P&L.
- **Cash in lieu:** record the cash event and, when applicable, a disposal allocation.
- **Merger, spinoff, symbol/ISIN change, delisting:** create a versioned corporate-action record with source evidence and the cost-allocation rule. Mark calculation incomplete until reviewed.
- **Stock dividend / DRIP:** record income first; shares received or purchased become a new lot. This prevents erasing income or double-counting it.
- **Dividend correction or tax refund:** append a linked correction, never mutate the original payment.
- **Transfers of securities:** preserve original cost/date when provided; otherwise create a `cost_unknown` lot and suppress realised/total asset return.

## Currency and timing

The initial API scope uses the broker primary currency. Still persist the original transaction currency, FX rate if exposed, conversion timestamp, and account-currency amount. Historical cost is converted with FX at the economic event time; applying current FX to historical cost is incorrect.

Store `executed_at`, `settled_at` when supplied, and `booked_at`. Returns use the documented execution/booked convention; cash reconciliation uses settlement/booked convention. The specific mapping is selected only after sample data validation.

## Reconciliation rules

For each instrument: `endQuantity = startQuantity + buys − sells ± corporateActions ± transfers`.

For account cash: `endCash = startCash + deposits − withdrawals − buys + sales + netDividends + netInterest − fees − taxes ± adjustments`.

For value: `endNAV − startNAV − netExternalFlows = totalResult`.

Reconcile after every sync. Tolerate only documented rounding (default: €0.01 per monetary source event); leave material mismatches as visible issues. A manual adjustment must have a reason, evidence link/reference, creator, timestamp, and reversal path.

## Explicit exclusions

Long-only Invest/ISA equity analysis is v1. CFDs, margin, short positions, options, crypto, financing charges, and tax calculation need their own accounting model and are not silently accepted as ordinary trades.

# Information Architecture and Product Behavior

## Global rules

The header always identifies selected account, period, reporting currency, last successful update, data coverage, and whether the view is **Actual**, **Estimated**, **Incomplete**, or **Hypothetical**. Positive/negative colour never carries meaning alone; all metrics include a sign, label, and accessible text.

```text
Dashboard
├── History
├── Assets
│   └── Asset detail
├── Activity
├── Projections
├── Synchronization
└── Settings
    ├── Portfolio profile
    ├── Methodology
    ├── Privacy and export
    └── Data deletion
```

Desktop uses a persistent side navigation. Mobile uses a bottom bar for Dashboard, History, Assets, Activity, and More. Tables become expandable records rather than horizontally inaccessible grids.

## Dashboard

The first screen answers, in this order: “What is my portfolio worth?”, “How much did I contribute?”, “What did investing produce?”, and “How reliable/current is this?”.

1. **Portfolio value:** total, cash, investments, timestamp and currency.
2. **Capital:** deposits, withdrawals, and net contributions. Do not call it “invested” when cash remains.
3. **Investment result:** amount plus realised/unrealised/income bridge.
4. **Returns:** separate cards for TWR, Modified Dietz, or XIRR; each states method and period.
5. **Evolution chart:** layers for total value, net contributions, withdrawals, dividends and result. Deposits must visibly explain rises that are not return.
6. **Allocation:** one selected dimension at a time (asset class, region, currency, sector); `Unclassified` is visible.
7. **Data quality:** last sync, data coverage start, unresolved issues, stale value warning, and link to the relevant review list.

## History

Range controls: 1W, 1M, 3M, 6M, YTD, 1Y, since inception, and custom. The screen contains a period table with start value, deposits, withdrawals, income, fees, investment result, end value, return method, and coverage. It has a text/table alternative to every chart.

Events plotted on the timeline distinguish deposit, withdrawal, buy, sale, dividend, fee, corporate action, correction, and missing-data gap. Never interpolate a missing valuation without a visible dotted line and label.

## Assets and asset detail

The asset list shows name, ticker/ISIN, quantity, current price/time, market value, portfolio weight, open cost basis, realised P&L, unrealised P&L, income, currency, and coverage. Filters include asset type, position state, currency, data status, account and text search.

An asset detail page separates its market quote history from the user's own result. It contains open lots, closed allocations, all transactions, income, corporate actions, cost-policy version, current pricing source/time, and reconciliation status. Unknown cost basis disables only affected result metrics.

## Activity and review queue

Activity is an auditable ledger, not a decorative feed. It supports filters by date, type, instrument, account, currency, source, and review status. An event detail exposes original fields, normalized values, rule version, calculation effect, and links to related lots/snapshots.

Permitted owner actions are: classify unknown event, propose a reversible adjustment, add a note, flag a duplicate, or restore a prior correction. Each action records actor, timestamp, reason, and before/after values. No source event can be edited destructively.

## Synchronization

Show connected, updating, current, partial, failed, and disconnected states in plain language. Display latest completed run, coverage, imported/ignored/pending counts, reconciliation issues, and a `Sync now` action. During an active job, retain prior data as `Last known value` and show progress stages: connect, download, normalize, reconcile, calculate.

## Projections

Projections own a separate route, accent, data model, and persistent **Hypothetical** badge. They never modify actual metrics or appear as an undifferentiated continuation of historical chart data.

Inputs: starting value (current or manual), contribution/withdrawal schedule, start/end date, annual contribution increase, annual return assumption, optional inflation, optional estimated fees, currency, scenario name, and notes. Results: final nominal value, inflation-adjusted value, future contributions, modeled growth, and annual table. Scenarios can be compared but are never labelled predictions or recommendations.

V1 is deterministic. Monte Carlo, tax modeling, goals, benchmarks, price alerts, collaboration, and multi-broker aggregation are later work after data reliability is proven.

## Critical states

| State | Required behavior |
|---|---|
| No connection | Explain secure server-side connection and offer setup; never ask for key in browser UI. |
| No transactions | Show current value if known; suppress history-dependent returns. |
| Partial history | State exact coverage start and hide unsupported since-inception metrics. |
| Sync failure | Preserve last data, give safe cause/retry, and never show fabricated zero. |
| Duplicate/conflict | Put in review queue; calculations use documented rule and flag uncertainty. |
| Missing price | State last available price/time; do not value at zero. |
| Projection | Use distinct styling and explanation at every entry point. |

## Accessibility requirements

Meet WCAG AA contrast. Provide keyboard navigation, visible focus, 44px touch targets, reduced-motion support, localized currency/date formatting, and chart tables/summaries for assistive technology. Essential methodology is visible or accessible via a clear control, never hover-only.


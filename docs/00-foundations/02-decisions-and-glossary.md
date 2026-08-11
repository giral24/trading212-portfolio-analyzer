# Decisions, Glossary, and Invariants

## Binding decisions

- Use TypeScript, Next.js App Router, Node.js Vercel Functions, Neon Postgres, Drizzle, and a decimal-safe money representation.
- Store timestamps in UTC, preserve the source timestamp, and make the account reporting timezone configurable.
- Store original and normalized records; never use JavaScript `number` as the authoritative representation of money or quantity.
- Use FIFO as the initial lot-matching policy. The policy is versioned and visible in the UI.
- Show return calculations only when their required data coverage is available; show `Not available` rather than a zero or extrapolation.
- Use an allowlisted single-user authentication account before exposing portfolio data on a public URL.

## Glossary

| Term | Meaning |
|---|---|
| External cash flow | A deposit, withdrawal, or external transfer that changes account capital. Purchases, sales, and reinvestment are not external flows. |
| Total value | Cash plus market value of open positions in the account currency at a timestamp. |
| Net contributions | Deposits minus withdrawals. |
| Total investment result | `total value + withdrawals − deposits`, after all classified external flows. |
| Realised P&L | Net proceeds from a sale less the matched cost basis and attributable costs. |
| Unrealised P&L | Current market value of open lots less their remaining cost basis. |
| TWR | Time-weighted return: compounded return that neutralises external cash flows. |
| XIRR / MWR | Money-weighted return: annualised return affected by the amount and timing of the investor's cash flows. |
| Snapshot | Stored account and position valuation at a known point in time. |
| Coverage | The time range and data conditions under which a metric is reliable. |
| Adjustment | Explicit, auditable correction to source classification or missing data; never an invisible edit. |

## Non-negotiable invariants

1. A source event is idempotent: importing it twice creates one canonical record.
2. Derived records carry the calculation-policy version that produced them.
3. Internal activity—buying, selling, reinvesting dividends, or moving cash between internal buckets—does not alter net contributions.
4. A position quantity calculated from open lots must reconcile with the latest broker position within declared rounding tolerance.
5. A display cannot call a value "return" without declaring TWR, XIRR, Modified Dietz, or simple value change.
6. Manual corrections are append-only, attributed, reversible, and included in reconciliation.
7. Secrets never enter client bundles, raw event payloads, logs, exports, tests, screenshots, or Markdown.

## Open validations

The documents in [05-research](../05-research/01-validation-backlog.md) define what must be confirmed from a Trading 212 demo response or sanitized CSV before implementation relies on it.

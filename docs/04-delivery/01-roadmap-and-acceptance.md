# Roadmap and Acceptance Gates

## Phase 0 — Contract proof

Use a Trading 212 demo account or sanitized export. Build no production UI or live credential flow before the validation backlog is closed.

**Exit gate:** fixtures exist for account summary, positions, historical orders, transactions, dividends, report generation/polling/download; every source field/sign/timestamp used by v1 is observed and documented.

## Phase 1 — Trusted accounting core

Deliver schema, idempotent ingestion, classification, FIFO lots, snapshots, reconciliation, and pure calculation tests.

**Exit gate:** seeded scenarios for deposits, withdrawals, partial sales, dividends, fees, reinvestment, and stale/missing data reconcile exactly; repeated imports do not alter results; browser access cannot reach credentials.

## Phase 2 — Private operational application

Deliver authentication, secure production configuration, manual sync, safe daily cron, dashboard, history, activity, assets, and data-quality states.

**Exit gate:** an allowlisted owner can sync a demo account, inspect an auditable result, resolve an unknown event, and see the same result after a second sync. A preview has no real key or financial data.

## Phase 3 — Projections

Deliver an isolated deterministic scenario tool, comparison, assumptions, and accessibility.

**Exit gate:** standard monthly-contribution examples match independently calculated expected values; no historical screen treats scenario output as actual data.

## Phase 4 — Controlled enhancement

Only after the first real account is reconciled: external historical pricing, true backfilled TWR, benchmarks, multiple accounts/brokers, advanced corporate actions, tax export, and probabilistic scenarios.

## Definition of done for every increment

- Tests prove the new behavior and protect the error/edge case.
- All displayed metrics declare method, period, currency, and coverage.
- No sensitive values exist in source, fixtures, logs, or previews.
- Database migration has forward and rollback considerations.
- Sync is idempotent, observable, and reconciled when it touches provider data.
- Keyboard, screen-reader, mobile, empty, loading, and failure states are considered for UI work.
- Documentation and links in [the index](../README.md) remain correct.

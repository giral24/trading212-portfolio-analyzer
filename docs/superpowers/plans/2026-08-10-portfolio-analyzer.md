# Trading 212 Portfolio Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, read-only Trading 212 analysis application that reconciles account data, calculates explainable performance, and keeps projections isolated from observed history.

**Architecture:** A local-only Next.js App Router application uses a Node.js server to ingest allowlisted Trading 212 read endpoints. Local Postgres preserves immutable source records, snapshots, accounting results, and operational history. Pure TypeScript domain functions calculate classifications, FIFO lots, P&L, TWR/Dietz, XIRR, reconciliation, and projections; UI routes consume typed read models only.

**Tech Stack:** Node.js 24, Next.js 16, TypeScript, Tailwind CSS 4, Drizzle ORM, local Postgres via Docker, Zod, decimal.js, Vitest, and Playwright. Remote deployment services are deferred.

## Global Constraints

- Read [the documentation index](../../README.md) and obey all linked decisions before editing code.
- Use the local Node.js server, never a browser client, for database or Trading 212 access.
- `T212_API_KEY` and `T212_API_SECRET` are server-only variables in the ignored local `.env`; never ask for or render them in the UI.
- Implement only Trading 212 GET requests and history export report creation/polling; never add trade, order, or Pie write calls.
- Persist money and quantities as decimal strings/SQL `numeric`; do not use JavaScript `number` for authoritative calculations.
- Use UTC timestamps and a configurable account reporting timezone. Return metrics only with declared method, period, currency, and coverage.
- Default cost policy is FIFO v1. Source facts and manual adjustments are append-only and idempotent.
- No remote deployment, preview, hosted database, or remote scheduler is configured in the local-first phase.
- Actual data and projections remain different routes, tables, labels, and visual tokens.

---

## File Structure

```text
src/
├── app/                         # App Router pages and protected route handlers
├── components/                  # reusable presentation-only components
├── db/                          # Drizzle schema, migration config, database factory
├── domain/                      # pure calculations; no DB, HTTP, or React imports
├── features/                    # dashboard, history, assets, activity, projections
├── lib/                         # formatting, date range, auth, environment validation
├── server/                      # provider adapter, ingestion, sync, read models
└── styles/                      # Tailwind theme and token definitions
tests/
├── domain/                      # deterministic calculation tests
├── integration/                 # Postgres/adapter/ingestion tests with fixtures
├── e2e/                         # protected UI and operational flows
└── fixtures/trading212/         # sanitized, never real, provider responses
drizzle/                         # generated SQL migrations
```

## Task 1: Bootstrap a private, testable application

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/styles/globals.css`, `src/lib/env.ts`
- Create: `tests/domain/smoke.test.ts`, `tests/e2e/home.spec.ts`

**Interfaces:** `getEnv(): ServerEnv` validates server-only configuration. `src/domain/` must stay dependency-free apart from decimal/date utilities.

- [ ] Initialise the root package with `pnpm init`, then create the `src/`, `tests/`, and `drizzle/` paths shown above. Preserve the existing `docs/` and `AGENTS.md` files; do not scaffold into a temporary nested application.
- [ ] Add Next.js App Router, React, TypeScript, Tailwind, and ESLint configuration at the repository root. Add exact runtime scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, and `db:generate`.
- [ ] Add dependencies `decimal.js`, `zod`, `drizzle-orm`, and `postgres`; add dev dependencies `vitest`, `@vitest/coverage-v8`, `playwright`, `drizzle-kit`, and `dotenv-cli`.
- [ ] Write the failing environment test:

```ts
it('rejects a public Trading 212 secret', () => {
  expect(() => getEnv({ NEXT_PUBLIC_T212_API_SECRET: 'x' })).toThrow();
});
```

- [ ] Implement `getEnv` to require `DATABASE_URL` only at execution time, reject `NEXT_PUBLIC_T212_*` variables, and expose no Trading 212 variable to client modules.
- [ ] Define the midnight-ledger tokens from [the design system](../../03-product-and-design/02-dark-design-system.md) in `globals.css`, then render a minimal non-financial private-app shell.
- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then commit `chore: bootstrap private portfolio app`.

## Task 2: Implement the pure financial domain and fixtures

**Files:**
- Create: `src/domain/money.ts`, `src/domain/types.ts`, `src/domain/returns.ts`, `src/domain/lots.ts`, `src/domain/reconciliation.ts`
- Create: `tests/domain/returns.test.ts`, `tests/domain/lots.test.ts`, `tests/domain/reconciliation.test.ts`

**Interfaces:**

```ts
export type Money = { amount: string; currency: string };
export type ExternalFlow = { occurredAt: Date; amount: Decimal };
export function calculateXirr(flows: ExternalFlow[]): Decimal | null;
export function calculateModifiedDietz(input: DietzInput): Decimal | null;
export function allocateFifoSale(lots: OpenLot[], sale: Sale): DisposalAllocation[];
```

- [ ] Write failing examples covering the user's `€200 → €220 → reinvest` case, a mid-month €500 deposit, partial sales, fractional quantities, fee-on-buy, fee-on-sell, and an XIRR with dated deposits/ending NAV.
- [ ] Implement Decimal construction/formatting with explicit currency validation; prohibit implicit `number` conversion in domain functions.
- [ ] Implement true-TWR availability checks, Modified Dietz, XIRR root/ambiguity handling, annualisation, FIFO disposal allocation, realised/unrealised P&L, and the three reconciliation identities from [metrics](../../01-financial-domain/01-metrics-and-formulas.md).
- [ ] Add property-style assertions: imported order does not change net contributions; sum of disposal allocations never exceeds lot quantity; repeated calculation gives the same output.
- [ ] Run `pnpm test -- tests/domain` and commit `feat: add audited portfolio calculation domain`.

## Task 3: Define Postgres schema and safe database access

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `docker-compose.yml`
- Create: `tests/integration/schema.test.ts`
- Generate: `drizzle/0000_initial.sql`

**Interfaces:** `getDb(): DrizzleDatabase` initializes lazily during function execution. Every source table contains source ID/hash, account ID, `createdAt`, `observedAt`, and raw JSON where appropriate.

- [ ] Write a schema test asserting unique `(source, external_id)` raw events and `numeric` types for amount/quantity columns.
- [ ] Add the local Docker Postgres service now, using a named volume and a port bound to loopback only so the local Node.js process can run migrations and integration tests. Keep credentials and the connection URL only in ignored `.env`.
- [ ] Define all tables listed in [architecture and data model](../../02-data-and-integration/02-architecture-and-data-model.md), including leases, checkpoints, snapshots, lot allocations, issues, adjustments, and isolated projection scenarios.
- [ ] Add foreign keys, check constraints for non-negative remaining lot quantity, unique snapshot identities, and indexes for account/date/event retrieval.
- [ ] Implement a plain lazy `getDb()` factory; do not use a JavaScript Proxy around the DB client.
- [ ] Generate and inspect migration SQL, apply it only to a disposable local Docker Postgres database, run integration tests, and commit `feat: add auditable portfolio schema`.

## Task 4: Build a validated, read-only Trading 212 adapter

**Files:**
- Create: `src/server/trading212/client.ts`, `src/server/trading212/schemas.ts`, `src/server/trading212/pagination.ts`, `src/server/trading212/exports.ts`
- Create: `tests/fixtures/trading212/*.json`, `tests/integration/trading212-adapter.test.ts`

**Interfaces:**

```ts
export interface Trading212Client {
  getSummary(): Promise<AccountSummary>;
  getPositions(): Promise<Position[]>;
  listOrders(cursor?: string): Promise<Page<HistoricalOrder>>;
  listTransactions(cursor?: string): Promise<Page<HistoryTransaction>>;
  listDividends(cursor?: string): Promise<Page<HistoryDividend>>;
  requestExport(input: ExportRequest): Promise<{ reportId: string }>;
}
```

- [ ] Create sanitized fixtures only after closing the checks in [the validation backlog](../../05-research/01-validation-backlog.md); no fabricated field is allowed into a schema.
- [ ] Write failing tests for Basic auth construction, forbidden non-GET request paths, exact `nextPagePath` consumption, API `429` retry-until-reset behavior, and non-retry of `401`, `403`, and schema `400`.
- [ ] Implement Zod validation at every provider boundary, request timeouts, sanitised errors, sequential pagination, and rate-limit-header-aware retry.
- [ ] Implement export request/poll/download as a server-only service; reuse the CSV normalizer in Task 5.
- [ ] Run adapter tests with a mocked `fetch`, inspect that no secret occurs in failure output, and commit `feat: add read-only Trading 212 adapter`.

## Task 5: Implement idempotent ingestion and reconciliation

**Files:**
- Create: `src/server/import/csv.ts`, `src/server/import/normalize.ts`, `src/server/import/ingest.ts`, `src/server/sync/service.ts`, `src/server/sync/lease.ts`
- Create: `tests/integration/ingest.test.ts`, `tests/integration/sync.test.ts`

**Interfaces:** `syncAccount(accountId: string, trigger: 'manual'): Promise<SyncResult>`; `ingestPage(input: ProviderPage): Promise<IngestionCounters>`.

- [ ] Write failing integration tests for importing the same page twice, a failed page resume, concurrent manual requests, seven-day overlap deduplication, unknown cash type, and a material reconciliation mismatch.
- [ ] Implement raw-event upsert by external ID or canonical payload hash, source/CSV import provenance, checkpoint only after transaction commit, and append-only snapshots.
- [ ] Implement transactional account lease acquisition/expiry/release. If a lease exists, return a safe skipped result rather than running in parallel.
- [ ] Normalize provider types to the event classes in [events and lots](../../01-financial-domain/02-events-lots-and-edge-cases.md); preserve unknown records and create review issues.
- [ ] Rebuild affected FIFO lots/read models and persist cash/quantity/NAV reconciliation issues without auto-adjusting them.
- [ ] Run integration tests against a disposable development database and commit `feat: add idempotent account synchronization`.

## Task 6: Restrict local access and add a manual sync route

**Files:**
- Create: `src/lib/local-access.ts`, `src/app/api/sync/manual/route.ts`
- Modify: `src/app/layout.tsx`, `next.config.ts`
- Create: `tests/integration/sync-routes.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:** `assertLocalRequest(request: Request): void` rejects non-loopback requests. `POST /api/sync/manual` is available only to the local owner.

- [ ] Write failing route tests: a non-loopback request gets `403`, a loopback request triggers sync, a concurrent sync is skipped, and no route response returns secrets or raw payloads.
- [ ] Implement loopback-only local binding and local request validation. Do not add remote authentication, tunneling, or cron.
- [ ] Add a documented local command to trigger sync manually; ensure it uses the same lease/idempotency path as the route.
- [ ] Run e2e tests using the local server and commit `feat: restrict local portfolio access and sync`.

## Task 7: Deliver dashboard and history read models

**Files:**
- Create: `src/features/dashboard/queries.ts`, `src/features/dashboard/dashboard.tsx`, `src/features/history/queries.ts`, `src/features/history/history.tsx`
- Create: `src/components/metric-card.tsx`, `src/components/coverage-badge.tsx`, `src/components/portfolio-chart.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/history/page.tsx`
- Create: `tests/domain/dashboard-read-model.test.ts`, `tests/e2e/dashboard.spec.ts`

**Interfaces:** `getDashboardModel(range: DateRange): Promise<DashboardModel>` returns `MetricValue { value, method, period, currency, coverage, status }`; the component cannot render a bare percentage.

- [ ] Write tests that hide TWR when flow-boundary snapshots are absent, label Dietz as estimated, separate deposits from result on timeline data, and show exact coverage date.
- [ ] Implement query/read-model functions using stored snapshots and calculation outputs; never recompute financial logic in React components.
- [ ] Implement metric cards, range selector, data-quality panel, accessible chart/table alternative, history period table, loading/empty/error states, and midnight-ledger responsive styling.
- [ ] Add Playwright cases for keyboard navigation, visible method labels, partial history banner, and mobile viewport.
- [ ] Run unit/e2e tests and commit `feat: add explainable dashboard and history`.

## Task 8: Deliver assets, activity, review, and sync UX

**Files:**
- Create: `src/features/assets/*`, `src/features/activity/*`, `src/features/sync/*`
- Create: `src/app/(app)/assets/page.tsx`, `src/app/(app)/assets/[instrumentId]/page.tsx`, `src/app/(app)/activity/page.tsx`, `src/app/(app)/sync/page.tsx`
- Create: `tests/e2e/activity-review.spec.ts`, `tests/e2e/sync.spec.ts`

**Interfaces:** `getAssetDetail(instrumentId): AssetDetailModel`; `createManualAdjustment(input): AdjustmentResult`; `getSyncStatus(): SyncStatusModel`.

- [ ] Write failing tests for an asset with unknown cost, a partial sale with multiple lot allocations, an unclassified cash event, a reversible manual correction, a stale snapshot, and a skipped concurrent sync.
- [ ] Implement audit tables with filters/detail links; show original vs normalized fields and rule version without exposing raw secrets.
- [ ] Implement manual classification/adjustment as an append-only action with reason, actor and reversal; force recalculation/reconciliation afterward.
- [ ] Implement asset list/detail and sync-status/progress views as specified in [information architecture](../../03-product-and-design/01-information-architecture.md).
- [ ] Test local-only workflows and commit `feat: add assets activity and data review workflows`.

## Task 9: Implement projections as a separate bounded domain

**Files:**
- Create: `src/domain/projections.ts`, `src/features/projections/*`, `src/app/(app)/projections/page.tsx`
- Create: `tests/domain/projections.test.ts`, `tests/e2e/projections.spec.ts`

**Interfaces:**

```ts
export type ProjectionScenario = { initialValue: Decimal; annualReturn: Decimal; monthlyContribution: Decimal; months: number; annualContributionGrowth: Decimal; inflation: Decimal; };
export function projectScenario(input: ProjectionScenario): ProjectionResult;
```

- [ ] Write failing tests for zero return, monthly contributions, contribution stop date, annual contribution increase, inflation-adjusted result, and invalid negative horizon.
- [ ] Implement monthly deterministic compounding with inputs/results stored only in `projection_scenarios`; do not query or mutate actual-account calculation tables except to optionally seed starting value.
- [ ] Implement scenario builder, comparison, contribution-vs-growth chart, assumptions panel, persistent Hypothetical badge, table alternative, and explicit non-prediction copy.
- [ ] Run tests and commit `feat: add isolated investment projection scenarios`.

## Task 10: Local hardening and future deployment readiness

**Files:**
- Create: `.github/workflows/ci.yml`, `docs/05-research/observations/README.md`, `docs/04-delivery/release-checklist.md`
- Modify: `README.md`, `AGENTS.md`
- Test: complete `pnpm lint`, `pnpm typecheck`, `pnpm test -- --coverage`, `pnpm test:e2e`, `pnpm build`

- [ ] Add CI for lint, typecheck, unit/integration tests, build, and Playwright against fixtures. Require it before merging to `main`.
- [ ] Verify the existing local Docker Postgres service has a named volume, loopback-only binding, and no credentials or connection URL committed to Git.
- [ ] Document a future deployment checklist without configuring any provider, secret, cron, or marketplace integration.
- [ ] Complete the validation backlog with demo/sanitized data, create documentation observations, run a manual sync, and prove repeated sync is idempotent.
- [ ] Perform an encrypted local backup/restore rehearsal to an isolated database and validate that account snapshots, raw events, lots, and read models restore consistently.
- [ ] Test the local release checklist: loopback binding, secret scan, no order endpoint, reconciliation status, data freshness, mobile/accessibility smoke test, and recovery.
- [ ] Commit `chore: prepare secure local release`.

## Final Verification

- [ ] Compare every requirement in `docs/00` through `docs/05` to one of the tasks above; add a task before coding if any is unrepresented.
- [ ] Search all committed files for `T212_API_SECRET`, real account IDs, exports, `NEXT_PUBLIC_T212`, order-write endpoint paths, `TODO`, and `TBD`; resolve all findings except documented variable names.
- [ ] Confirm UI does not show return metrics without metadata and does not combine projection rows/charts with actual portfolio results.
- [ ] Confirm every source import can run twice without duplicates and every mismatch reaches the review queue.
- [ ] Request a final security and financial-methodology review before enabling a live API key.

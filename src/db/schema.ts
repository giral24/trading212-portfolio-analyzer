import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const observedAt = () => timestamp('observed_at', { withTimezone: true }).notNull();
const currency = (name: string) => text(name);

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull(),
  externalAccountId: text('external_account_id').notNull(),
  environment: text('environment').notNull(),
  reportingCurrency: currency('reporting_currency').notNull(),
  reportingTimezone: text('reporting_timezone').notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique('accounts_provider_external_account_environment_unique').on(table.provider, table.externalAccountId, table.environment),
]);

export const instruments = pgTable('instruments', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull(),
  externalInstrumentId: text('external_instrument_id').notNull(),
  ticker: text('ticker').notNull(),
  isin: text('isin'),
  exchange: text('exchange'),
  name: text('name'),
  instrumentType: text('instrument_type'),
  createdAt: createdAt(),
}, (table) => [
  unique('instruments_provider_external_id_unique').on(table.provider, table.externalInstrumentId),
  index('instruments_provider_ticker_index').on(table.provider, table.ticker),
]);

export const importSources = pgTable('import_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  sourceHash: text('source_hash').notNull(),
  parserVersion: text('parser_version').notNull(),
  rangeStart: timestamp('range_start', { withTimezone: true }),
  rangeEnd: timestamp('range_end', { withTimezone: true }),
  createdAt: createdAt(),
  observedAt: observedAt(),
  rawPayload: jsonb('raw_payload'),
}, (table) => [
  unique('import_sources_account_source_hash_unique').on(table.accountId, table.source, table.sourceHash),
  index('import_sources_account_observed_at_index').on(table.accountId, table.observedAt),
]);

export const rawEvents = pgTable('raw_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  importSourceId: uuid('import_source_id').references(() => importSources.id, { onDelete: 'set null' }),
  source: text('source').notNull(),
  externalId: text('external_id'),
  canonicalHash: text('canonical_hash').notNull(),
  providerType: text('provider_type'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }),
  createdAt: createdAt(),
  observedAt: observedAt(),
  rawPayload: jsonb('raw_payload').notNull(),
}, (table) => [
  unique('raw_events_source_external_id_unique').on(table.source, table.externalId),
  uniqueIndex('raw_events_canonical_hash_unique').on(table.canonicalHash),
  index('raw_events_account_occurred_at_index').on(table.accountId, table.occurredAt),
]);

export const syncRuns = pgTable('sync_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  trigger: text('trigger').notNull(),
  status: text('status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  endpoint: text('endpoint'),
  pageCount: integer('page_count').notNull().default(0),
  retryCount: integer('retry_count').notNull().default(0),
  createdCount: integer('created_count').notNull().default(0),
  updatedCount: integer('updated_count').notNull().default(0),
  ignoredCount: integer('ignored_count').notNull().default(0),
  watermark: timestamp('watermark', { withTimezone: true }),
  safeErrorCode: text('safe_error_code'),
  createdAt: createdAt(),
}, (table) => [
  index('sync_runs_account_started_at_index').on(table.accountId, table.startedAt),
]);

export const cashTransactions = pgTable('cash_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  rawEventId: uuid('raw_event_id').notNull().references(() => rawEvents.id, { onDelete: 'restrict' }),
  source: text('source').notNull(),
  externalId: text('external_id').notNull(),
  sourceHash: text('source_hash').notNull(),
  transactionType: text('transaction_type').notNull(),
  amountOriginalCurrency: numeric('amount_original_currency').notNull(),
  originalCurrency: currency('original_currency').notNull(),
  amountAccountCurrency: numeric('amount_account_currency').notNull(),
  accountCurrency: currency('account_currency').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  observedAt: observedAt(),
  rawPayload: jsonb('raw_payload').notNull(),
}, (table) => [
  unique('cash_transactions_account_external_id_unique').on(table.accountId, table.externalId),
  uniqueIndex('cash_transactions_source_hash_unique').on(table.sourceHash),
  index('cash_transactions_account_occurred_at_index').on(table.accountId, table.occurredAt),
]);

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  instrumentId: uuid('instrument_id').references(() => instruments.id, { onDelete: 'set null' }),
  rawEventId: uuid('raw_event_id').notNull().references(() => rawEvents.id, { onDelete: 'restrict' }),
  source: text('source').notNull(),
  externalId: text('external_id').notNull(),
  sourceHash: text('source_hash').notNull(),
  side: text('side').notNull(),
  status: text('status').notNull(),
  quantity: numeric('quantity').notNull(),
  price: numeric('price'),
  grossValue: numeric('gross_value').notNull(),
  fee: numeric('fee').notNull().default('0'),
  accountCurrency: currency('account_currency').notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  bookedAt: timestamp('booked_at', { withTimezone: true }),
  createdAt: createdAt(),
  observedAt: observedAt(),
  rawPayload: jsonb('raw_payload').notNull(),
}, (table) => [
  unique('orders_account_external_id_unique').on(table.accountId, table.externalId),
  uniqueIndex('orders_source_hash_unique').on(table.sourceHash),
  index('orders_account_executed_at_index').on(table.accountId, table.executedAt),
]);

export const dividends = pgTable('dividends', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  instrumentId: uuid('instrument_id').references(() => instruments.id, { onDelete: 'set null' }),
  rawEventId: uuid('raw_event_id').notNull().references(() => rawEvents.id, { onDelete: 'restrict' }),
  source: text('source').notNull(),
  externalId: text('external_id').notNull(),
  sourceHash: text('source_hash').notNull(),
  grossAmount: numeric('gross_amount').notNull(),
  withheldAmount: numeric('withheld_amount').notNull().default('0'),
  netAmount: numeric('net_amount').notNull(),
  accountCurrency: currency('account_currency').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  observedAt: observedAt(),
  rawPayload: jsonb('raw_payload').notNull(),
}, (table) => [
  unique('dividends_account_external_id_unique').on(table.accountId, table.externalId),
  uniqueIndex('dividends_source_hash_unique').on(table.sourceHash),
  index('dividends_account_paid_at_index').on(table.accountId, table.paidAt),
]);

export const accountSnapshots = pgTable('account_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id, { onDelete: 'set null' }),
  source: text('source').notNull(),
  sourceHash: text('source_hash').notNull(),
  cashValue: numeric('cash_value').notNull(),
  investedValue: numeric('invested_value').notNull(),
  totalValue: numeric('total_value').notNull(),
  accountCurrency: currency('account_currency').notNull(),
  createdAt: createdAt(),
  observedAt: observedAt(),
  rawPayload: jsonb('raw_payload').notNull(),
}, (table) => [
  unique('account_snapshots_account_observed_at_unique').on(table.accountId, table.observedAt),
  uniqueIndex('account_snapshots_source_hash_unique').on(table.sourceHash),
  index('account_snapshots_account_observed_at_index').on(table.accountId, table.observedAt),
]);

export const positionSnapshots = pgTable('position_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  instrumentId: uuid('instrument_id').notNull().references(() => instruments.id, { onDelete: 'restrict' }),
  accountSnapshotId: uuid('account_snapshot_id').notNull().references(() => accountSnapshots.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  sourceHash: text('source_hash').notNull(),
  quantity: numeric('quantity').notNull(),
  price: numeric('price'),
  marketValue: numeric('market_value'),
  accountCurrency: currency('account_currency').notNull(),
  createdAt: createdAt(),
  observedAt: observedAt(),
  rawPayload: jsonb('raw_payload').notNull(),
}, (table) => [
  unique('position_snapshots_account_instrument_snapshot_unique').on(table.accountId, table.instrumentId, table.accountSnapshotId),
  uniqueIndex('position_snapshots_source_hash_unique').on(table.sourceHash),
  index('position_snapshots_account_instrument_index').on(table.accountId, table.instrumentId),
]);

export const classifications = pgTable('classifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  rawEventId: uuid('raw_event_id').notNull().references(() => rawEvents.id, { onDelete: 'cascade' }),
  normalizedType: text('normalized_type').notNull(),
  policyVersion: text('policy_version').notNull(),
  source: text('source').notNull(),
  isManual: boolean('is_manual').notNull().default(false),
  reason: text('reason'),
  createdAt: createdAt(),
  observedAt: observedAt(),
}, (table) => [
  index('classifications_account_event_index').on(table.accountId, table.rawEventId),
]);

export const lots = pgTable('lots', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  instrumentId: uuid('instrument_id').notNull().references(() => instruments.id, { onDelete: 'restrict' }),
  openingOrderId: uuid('opening_order_id').references(() => orders.id, { onDelete: 'restrict' }),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
  originalQuantity: numeric('original_quantity').notNull(),
  remainingQuantity: numeric('remaining_quantity').notNull(),
  adjustedCost: numeric('adjusted_cost').notNull(),
  accountCurrency: currency('account_currency').notNull(),
  costKnown: boolean('cost_known').notNull().default(true),
  policyVersion: text('policy_version').notNull(),
  createdAt: createdAt(),
  observedAt: observedAt(),
}, (table) => [
  check('lots_remaining_quantity_nonnegative', sql`${table.remainingQuantity} >= 0`),
  index('lots_account_instrument_opened_at_index').on(table.accountId, table.instrumentId, table.openedAt),
]);

export const lotDisposals = pgTable('lot_disposals', {
  id: uuid('id').defaultRandom().primaryKey(),
  lotId: uuid('lot_id').notNull().references(() => lots.id, { onDelete: 'restrict' }),
  saleOrderId: uuid('sale_order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
  quantity: numeric('quantity').notNull(),
  adjustedCost: numeric('adjusted_cost').notNull(),
  netProceeds: numeric('net_proceeds').notNull(),
  realizedPnl: numeric('realized_pnl').notNull(),
  policyVersion: text('policy_version').notNull(),
  createdAt: createdAt(),
}, (table) => [
  check('lot_disposals_quantity_positive', sql`${table.quantity} > 0`),
  unique('lot_disposals_lot_sale_unique').on(table.lotId, table.saleOrderId),
  index('lot_disposals_sale_order_index').on(table.saleOrderId),
]);

export const syncCheckpoints = pgTable('sync_checkpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  stream: text('stream').notNull(),
  cursor: text('cursor'),
  watermark: timestamp('watermark', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique('sync_checkpoints_account_stream_unique').on(table.accountId, table.stream),
]);

export const syncLeases = pgTable('sync_leases', {
  accountId: uuid('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  owner: text('owner').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const reconciliationIssues = pgTable('reconciliation_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  syncRunId: uuid('sync_run_id').references(() => syncRuns.id, { onDelete: 'set null' }),
  rawEventId: uuid('raw_event_id').references(() => rawEvents.id, { onDelete: 'set null' }),
  issueType: text('issue_type').notNull(),
  severity: text('severity').notNull(),
  expectedValue: numeric('expected_value'),
  actualValue: numeric('actual_value'),
  difference: numeric('difference'),
  accountCurrency: currency('account_currency'),
  status: text('status').notNull().default('open'),
  evidence: jsonb('evidence'),
  createdAt: createdAt(),
  observedAt: observedAt(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => [
  index('reconciliation_issues_account_status_index').on(table.accountId, table.status),
]);

export const manualAdjustments = pgTable('manual_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  rawEventId: uuid('raw_event_id').references(() => rawEvents.id, { onDelete: 'set null' }),
  reversalOfId: uuid('reversal_of_id'),
  adjustmentType: text('adjustment_type').notNull(),
  amount: numeric('amount'),
  accountCurrency: currency('account_currency'),
  reason: text('reason').notNull(),
  evidenceReference: text('evidence_reference').notNull(),
  actor: text('actor').notNull(),
  createdAt: createdAt(),
  observedAt: observedAt(),
}, (table) => [
  index('manual_adjustments_account_created_at_index').on(table.accountId, table.createdAt),
]);

export const projectionScenarios = pgTable('projection_scenarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  initialValue: numeric('initial_value').notNull(),
  annualReturn: numeric('annual_return').notNull(),
  monthlyContribution: numeric('monthly_contribution').notNull(),
  months: integer('months').notNull(),
  annualContributionGrowth: numeric('annual_contribution_growth').notNull().default('0'),
  inflation: numeric('inflation').notNull().default('0'),
  accountCurrency: currency('account_currency').notNull(),
  assumptions: jsonb('assumptions').notNull(),
  result: jsonb('result'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('projection_scenarios_months_nonnegative', sql`${table.months} >= 0`),
  index('projection_scenarios_account_created_at_index').on(table.accountId, table.createdAt),
]);

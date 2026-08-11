CREATE TABLE "account_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"sync_run_id" uuid,
	"source" text NOT NULL,
	"source_hash" text NOT NULL,
	"cash_value" numeric NOT NULL,
	"invested_value" numeric NOT NULL,
	"total_value" numeric NOT NULL,
	"account_currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb NOT NULL,
	CONSTRAINT "account_snapshots_account_observed_at_unique" UNIQUE("account_id","observed_at")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text NOT NULL,
	"environment" text NOT NULL,
	"reporting_currency" text NOT NULL,
	"reporting_timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_provider_external_account_environment_unique" UNIQUE("provider","external_account_id","environment")
);
--> statement-breakpoint
CREATE TABLE "cash_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"raw_event_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"source_hash" text NOT NULL,
	"transaction_type" text NOT NULL,
	"amount_original_currency" numeric NOT NULL,
	"original_currency" text NOT NULL,
	"amount_account_currency" numeric NOT NULL,
	"account_currency" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb NOT NULL,
	CONSTRAINT "cash_transactions_account_external_id_unique" UNIQUE("account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"raw_event_id" uuid NOT NULL,
	"normalized_type" text NOT NULL,
	"policy_version" text NOT NULL,
	"source" text NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dividends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid,
	"raw_event_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"source_hash" text NOT NULL,
	"gross_amount" numeric NOT NULL,
	"withheld_amount" numeric DEFAULT '0' NOT NULL,
	"net_amount" numeric NOT NULL,
	"account_currency" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb NOT NULL,
	CONSTRAINT "dividends_account_external_id_unique" UNIQUE("account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "import_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_hash" text NOT NULL,
	"parser_version" text NOT NULL,
	"range_start" timestamp with time zone,
	"range_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb,
	CONSTRAINT "import_sources_account_source_hash_unique" UNIQUE("account_id","source","source_hash")
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_instrument_id" text NOT NULL,
	"ticker" text NOT NULL,
	"isin" text,
	"exchange" text,
	"name" text,
	"instrument_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_provider_external_id_unique" UNIQUE("provider","external_instrument_id")
);
--> statement-breakpoint
CREATE TABLE "lot_disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"sale_order_id" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"adjusted_cost" numeric NOT NULL,
	"net_proceeds" numeric NOT NULL,
	"realized_pnl" numeric NOT NULL,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lot_disposals_lot_sale_unique" UNIQUE("lot_id","sale_order_id"),
	CONSTRAINT "lot_disposals_quantity_positive" CHECK ("lot_disposals"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"opening_order_id" uuid,
	"opened_at" timestamp with time zone NOT NULL,
	"original_quantity" numeric NOT NULL,
	"remaining_quantity" numeric NOT NULL,
	"adjusted_cost" numeric NOT NULL,
	"account_currency" text NOT NULL,
	"cost_known" boolean DEFAULT true NOT NULL,
	"policy_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "lots_remaining_quantity_nonnegative" CHECK ("lots"."remaining_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "manual_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"raw_event_id" uuid,
	"reversal_of_id" uuid,
	"adjustment_type" text NOT NULL,
	"amount" numeric,
	"account_currency" text,
	"reason" text NOT NULL,
	"evidence_reference" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid,
	"raw_event_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"source_hash" text NOT NULL,
	"side" text NOT NULL,
	"status" text NOT NULL,
	"quantity" numeric NOT NULL,
	"price" numeric,
	"gross_value" numeric NOT NULL,
	"fee" numeric DEFAULT '0' NOT NULL,
	"account_currency" text NOT NULL,
	"executed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"booked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb NOT NULL,
	CONSTRAINT "orders_account_external_id_unique" UNIQUE("account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "position_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"account_snapshot_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_hash" text NOT NULL,
	"quantity" numeric NOT NULL,
	"price" numeric,
	"market_value" numeric,
	"account_currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb NOT NULL,
	CONSTRAINT "position_snapshots_account_instrument_snapshot_unique" UNIQUE("account_id","instrument_id","account_snapshot_id")
);
--> statement-breakpoint
CREATE TABLE "projection_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"name" text NOT NULL,
	"initial_value" numeric NOT NULL,
	"annual_return" numeric NOT NULL,
	"monthly_contribution" numeric NOT NULL,
	"months" integer NOT NULL,
	"annual_contribution_growth" numeric DEFAULT '0' NOT NULL,
	"inflation" numeric DEFAULT '0' NOT NULL,
	"account_currency" text NOT NULL,
	"assumptions" jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projection_scenarios_months_nonnegative" CHECK ("projection_scenarios"."months" >= 0)
);
--> statement-breakpoint
CREATE TABLE "raw_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"import_source_id" uuid,
	"source" text NOT NULL,
	"external_id" text,
	"canonical_hash" text NOT NULL,
	"provider_type" text,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb NOT NULL,
	CONSTRAINT "raw_events_source_external_id_unique" UNIQUE("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "reconciliation_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"sync_run_id" uuid,
	"raw_event_id" uuid,
	"issue_type" text NOT NULL,
	"severity" text NOT NULL,
	"expected_value" numeric,
	"actual_value" numeric,
	"difference" numeric,
	"account_currency" text,
	"status" text DEFAULT 'open' NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"stream" text NOT NULL,
	"cursor" text,
	"watermark" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_checkpoints_account_stream_unique" UNIQUE("account_id","stream")
);
--> statement-breakpoint
CREATE TABLE "sync_leases" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"endpoint" text,
	"page_count" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"ignored_count" integer DEFAULT 0 NOT NULL,
	"watermark" timestamp with time zone,
	"safe_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sources" ADD CONSTRAINT "import_sources_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_disposals" ADD CONSTRAINT "lot_disposals_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_disposals" ADD CONSTRAINT "lot_disposals_sale_order_id_orders_id_fk" FOREIGN KEY ("sale_order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_opening_order_id_orders_id_fk" FOREIGN KEY ("opening_order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_adjustments" ADD CONSTRAINT "manual_adjustments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_adjustments" ADD CONSTRAINT "manual_adjustments_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_account_snapshot_id_account_snapshots_id_fk" FOREIGN KEY ("account_snapshot_id") REFERENCES "public"."account_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_scenarios" ADD CONSTRAINT "projection_scenarios_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_import_source_id_import_sources_id_fk" FOREIGN KEY ("import_source_id") REFERENCES "public"."import_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_leases" ADD CONSTRAINT "sync_leases_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_snapshots_source_hash_unique" ON "account_snapshots" USING btree ("source_hash");--> statement-breakpoint
CREATE INDEX "account_snapshots_account_observed_at_index" ON "account_snapshots" USING btree ("account_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_transactions_source_hash_unique" ON "cash_transactions" USING btree ("source_hash");--> statement-breakpoint
CREATE INDEX "cash_transactions_account_occurred_at_index" ON "cash_transactions" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "classifications_account_event_index" ON "classifications" USING btree ("account_id","raw_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dividends_source_hash_unique" ON "dividends" USING btree ("source_hash");--> statement-breakpoint
CREATE INDEX "dividends_account_paid_at_index" ON "dividends" USING btree ("account_id","paid_at");--> statement-breakpoint
CREATE INDEX "import_sources_account_observed_at_index" ON "import_sources" USING btree ("account_id","observed_at");--> statement-breakpoint
CREATE INDEX "instruments_provider_ticker_index" ON "instruments" USING btree ("provider","ticker");--> statement-breakpoint
CREATE INDEX "lot_disposals_sale_order_index" ON "lot_disposals" USING btree ("sale_order_id");--> statement-breakpoint
CREATE INDEX "lots_account_instrument_opened_at_index" ON "lots" USING btree ("account_id","instrument_id","opened_at");--> statement-breakpoint
CREATE INDEX "manual_adjustments_account_created_at_index" ON "manual_adjustments" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_source_hash_unique" ON "orders" USING btree ("source_hash");--> statement-breakpoint
CREATE INDEX "orders_account_executed_at_index" ON "orders" USING btree ("account_id","executed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "position_snapshots_source_hash_unique" ON "position_snapshots" USING btree ("source_hash");--> statement-breakpoint
CREATE INDEX "position_snapshots_account_instrument_index" ON "position_snapshots" USING btree ("account_id","instrument_id");--> statement-breakpoint
CREATE INDEX "projection_scenarios_account_created_at_index" ON "projection_scenarios" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_events_canonical_hash_unique" ON "raw_events" USING btree ("canonical_hash");--> statement-breakpoint
CREATE INDEX "raw_events_account_occurred_at_index" ON "raw_events" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "reconciliation_issues_account_status_index" ON "reconciliation_issues" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "sync_runs_account_started_at_index" ON "sync_runs" USING btree ("account_id","started_at");
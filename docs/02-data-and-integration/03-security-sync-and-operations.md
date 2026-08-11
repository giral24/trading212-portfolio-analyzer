# Security, Synchronization, and Operations

## Credential configuration

When the owner supplies credentials later, add only these names as sensitive Vercel Production environment variables:

```text
T212_API_KEY
T212_API_SECRET
T212_API_BASE_URL
DATABASE_URL
CRON_SECRET
AUTH_ALLOWED_EMAIL
```

Values are never committed, pasted into a Markdown document, sent to the client, or configured in Preview. Vercel stores environment variables encrypted at rest and supports non-readable sensitive values; restrict Vercel project access to the owner. [Vercel environment variables](https://vercel.com/docs/environment-variables), [sensitive variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

The production onboarding must instruct the owner to create a dedicated Trading 212 read-only key. If it is exposed, revoke it in Trading 212, generate a replacement, update the Vercel secret, deploy, test one read call, then revoke the old key.

## Authentication of the web application

The production application is private even if its URL is public. Use an identity provider with a single allowlisted email (recommended: Clerk provisioned through Vercel Marketplace) and protect all portfolio, sync, configuration, and export routes. Deployment Protection remains enabled for Preview but is not the only production access control.

The web user's session and the cron caller are distinct trust boundaries. Sync actions require the authenticated allowlisted user; cron accepts only its own secret.

## Sync algorithm

```text
acquire account lease
create sync_run(status=running)
fetch summary + positions; persist snapshots
fetch incremental cash transactions, orders, dividends
for each page: validate -> raw upsert -> normalize -> checkpoint
rebuild affected lots/classifications/read models
run cash, position, and NAV reconciliation
mark sync_run succeeded, partial, or failed
release lease in finally
```

- A lease is stored transactionally with expiry. A second invocation returns `skipped: sync already running`.
- Initial historical backfill uses an API report/export and/or approved uploaded CSV, then paginated endpoints as a cross-check.
- Incremental sync begins at the latest complete watermark minus a seven-day overlap. Deduplicate by stable provider ID; otherwise use canonical content hash.
- Advance a checkpoint only after the page and all derived writes commit.
- Record snapshots rather than overwriting current state.
- Failed jobs are resumable and must not leave partial derived calculations marked complete.

Historical rate limits apply per account. Read the current `x-ratelimit-*` headers; page sequentially; on `429`, wait to the reset timestamp or use bounded exponential backoff with jitter. Retry only network errors, `408`, `429`, and `5xx`; stop immediately on persistent `401`, `403`, or schema errors. [Trading 212 rate-limit headers](https://docs.trading212.com/api/section/rate-limiting/response-headers).

## Scheduling

Provide `POST /api/sync/manual` for the owner and a Vercel Cron-protected `GET /api/cron/sync`. Daily sync is sufficient for v1. The cron route verifies its secret, but idempotency and leases are still required because delivery is not an exactly-once guarantee. [Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

The initial job should run once after market close in the account reporting timezone. Because Cron expressions are UTC and market schedules vary, persist snapshots with their exact timestamp and never call a snapshot a formal close unless confirmed.

## IP allowlisting decision

Trading 212 can restrict keys by IP/CIDR. Default Vercel egress IPs are dynamic. For allowlisting, activate Vercel Static IPs in the production function region and copy every assigned egress IP into Trading 212. This is an optional paid hardening measure; it supplements but cannot replace a read-only key and secret protection. [Vercel fixed IP guidance](https://vercel.com/kb/guide/can-i-get-a-fixed-ip-address).

## Observability, recovery, and privacy

Store sanitized operational events in `sync_runs`: endpoint, page count, duration, retry count, records created/updated/ignored, watermark, and a safe error code. Do not log authorization, secrets, full CSV content, raw financial payloads, or account IDs outside the encrypted database.

Alert on failed sync, stale data, persistent authentication failure, repeated rate limiting, reconciliation difference, and unclassified events. Keep app-level operational history in Neon because Vercel log retention is not the accounting audit trail.

Use Neon point-in-time recovery/backups appropriate to the chosen plan and test a restore into an isolated environment before relying on it. Download/export only owner-requested data. Account deletion removes application data and secrets but does not affect the Trading 212 account.

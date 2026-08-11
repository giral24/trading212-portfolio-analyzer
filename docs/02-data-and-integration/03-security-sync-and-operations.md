# Security, Synchronization, and Operations

## Credential configuration

When the owner supplies credentials later, add only these names to the local `.env` file:

```text
T212_API_KEY
T212_API_SECRET
T212_API_BASE_URL
DATABASE_URL
CRON_SECRET
AUTH_ALLOWED_EMAIL
```

Values are never committed, pasted into a Markdown document, sent to the client, or configured in a public service. `.env` is already ignored by Git; keep the device encrypted and do not copy this file to backups or chat. `.env.example` contains names only and remains safe to publish.

The local onboarding must instruct the owner to create a dedicated Trading 212 read-only key. If it is exposed, revoke it in Trading 212, generate a replacement, update local `.env`, test one local read call, then revoke the old key.

## Local access

The current application is available only on the local machine. Bind the local server to `127.0.0.1`, do not expose its port on the network, and do not configure a public authentication provider yet. If remote deployment is later approved, add application authentication before exposing any portfolio route.

Local browser access and the local sync command remain separate code paths. A future remote cron must have its own secret and must not reuse a browser session.

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

Provide a local owner-only manual sync command or route. Do not configure a remote cron. A future scheduler must preserve the same idempotency and lease behavior.

When the owner runs a sync, persist its exact timestamp and never call a snapshot a formal close unless confirmed.

## Deferred IP allowlisting

Trading 212 can restrict keys by IP/CIDR. Local use may use the current home/office IP only if it is stable enough; this is optional and can interrupt sync after an ISP IP change. Remote egress/IP allowlisting is deferred until deployment is selected.

## Observability, recovery, and privacy

Store sanitized operational events in `sync_runs`: endpoint, page count, duration, retry count, records created/updated/ignored, watermark, and a safe error code. Do not log authorization, secrets, full CSV content, raw financial payloads, or account IDs outside the local database.

Alert locally on failed sync, stale data, persistent authentication failure, repeated rate limiting, reconciliation difference, and unclassified events. Keep app-level operational history in local Postgres because terminal logs are not the accounting audit trail.

Use encrypted local backups and test a restore into an isolated local database before relying on it. Download/export only owner-requested data. Account deletion removes local application data and secrets but does not affect the Trading 212 account.

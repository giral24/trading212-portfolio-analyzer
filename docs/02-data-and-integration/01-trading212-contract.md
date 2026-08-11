# Trading 212 API Contract

## Guardrails

Trading 212 Public API v0 is beta. The application integrates only with a live or demo **Invest** / **Stocks & Shares ISA** account and uses read capabilities only. SIPP and API multi-currency support are outside this scope. Re-check the official reference before implementation because beta fields and limits can change. [General API information](https://docs.trading212.com/api/section/general-information/api-limitations).

The user creates the credential pair in Trading 212. The application cannot and must not retrieve it automatically. Once configured as deployment secrets, server functions authenticate to Trading 212 automatically on each sync.

| Environment | Base URL | Use |
|---|---|---|
| Demo | `https://demo.trading212.com/api/v0` | Contract tests and fixtures only |
| Live | `https://live.trading212.com/api/v0` | Production read-only sync |

## Required sources

| Domain | Endpoint / source | Purpose |
|---|---|---|
| Account summary | `GET /equity/account/summary` | Primary currency, cash, total value, broker P&L fields |
| Current positions | `GET /equity/positions` | Quantity, current value, broker position state |
| Instruments | `GET /equity/metadata/instruments` | Ticker, ISIN, name, exchange and metadata |
| Historical orders | `GET /equity/history/orders` | Purchases, sales, status, fill-related history |
| Dividends | `GET /equity/history/dividends` | Paid income and withholding details when exposed |
| Cash transactions | `GET /equity/history/transactions` | Deposits, withdrawals, and cash movements |
| Historical export | `POST` / `GET /equity/history/exports` | Initial backfill, audit and parser validation |

Historical collection endpoints paginate by cursor. Follow the full `nextPagePath` supplied by Trading 212 until it is `null`; never infer a cursor. The documented default page size is 20 and maximum is 50. [Historical API and pagination](https://docs.trading212.com/api/historical-events).

The historical export workflow is asynchronous: request orders, transactions, dividends, and interest for a date range; poll the report list; download only when status is `Finished`; then pass the CSV through the same normalizer as any manual import. [Export API](https://docs.trading212.com/api/historical-events/requestreport).

## Authentication and permissions

Requests use HTTP Basic authentication with `API_KEY:API_SECRET`. The API secret behaves like a password and is displayed only once when generated. Create a dedicated key, choose the minimum read permissions offered by the current Trading 212 UI, and do not permit order placement or Pie writing. [Trading 212 API key guidance](https://helpcentre.trading212.com/hc/en-us/articles/14584770928157-Trading-212-API-key).

The browser never receives either credential. Do not implement a generic Trading 212 HTTP proxy, order client, or `POST /equity/orders` capability.

## Import source policy

1. **Initial history:** request a full API export, then normalize it. A user-uploaded CSV is an approved alternative for recovery or validation.
2. **Canonical evidence:** retain the raw API/CSV payload and normalized record with a source and hash. The original uploaded file is deleted after parsing unless the owner explicitly enables encrypted archival.
3. **Ongoing truth:** use API events and snapshots; re-import a CSV for comparison when a reconciliation issue arises.
4. **Unknown data:** preserve it and queue it for review. Never discard or force it into a convenient category.

## Contract validation before production

Use only a demo key or sanitized export to record fixtures for each endpoint. Confirm actual field names, IDs, event ordering, sign conventions, pagination direction, report CSV headers, fee fields, dividend taxes, deposit/withdrawal labels, timestamps, corporate actions, and whether a historical order is an order or execution. Update this note with the observed schema version before enabling a live sync.

## Known data limitations

The documented contract provides current summaries/positions plus historical events. It does not document a historic account-NAV series. Therefore true historical TWR cannot be promised before the app begins retaining valuation snapshots. See [financial formulas](../01-financial-domain/01-metrics-and-formulas.md) and the [validation backlog](../05-research/01-validation-backlog.md).


# Product Vision and Scope

## Product statement

Build a private web application that turns Trading 212 account history into an explainable view of personal investment performance. It must distinguish money the investor added or removed from money produced or lost through investing.

The application is an analysis and planning tool. It does not place orders, make recommendations, offer tax advice, or promise investment outcomes.

## Problems it solves

- Realised gains must remain visible after their proceeds are reinvested.
- Deposits and withdrawals must not be mistaken for performance.
- A user must be able to see monetary profit/loss, investment return, and personal money-weighted return without conflating them.
- Repeated purchases and sales of the same asset must retain their full history.
- Historical facts and future projections must be visibly and semantically separate.

## Primary user and boundary

The first release serves one owner and one Trading 212 Invest or Stocks & Shares ISA account. The account currency is the presentation currency. Multi-user access, multiple brokers, tax filing, SIPP accounts, market alerts, social sharing, and trade execution are out of scope.

## Product principles

1. **Explain before impressing.** Every headline metric states its period, currency, source, and method.
2. **Facts are immutable.** Preserve source events; derived results can be rebuilt.
3. **No invented precision.** Missing valuations, cost basis, prices, or classifications suppress affected metrics and explain why.
4. **Cash matters.** Total portfolio performance includes cash and cash-equivalent account value.
5. **Projections are hypothetical.** They never share the same visual meaning as observed account history.
6. **Read-only by design.** The integration has the minimum Trading 212 permissions and no order endpoints are implemented.

## Success criteria

For any selected period, the user can answer: current value; deposits; withdrawals; net contributed capital; monetary investment result; realised and unrealised components; dividends/interest; and clearly labelled TWR or XIRR when data coverage supports it. Every displayed total reconciles to stored events or a marked manual adjustment.

## Scope decisions

| Decision | Rationale |
|---|---|
| Vercel hosts the application; GitHub hosts source and CI | A server-side runtime is required to protect credentials and schedule syncs. |
| Neon Postgres is the system of record | Event history and auditability need relational transactions and constraints. |
| Trading 212 API is read-only | Analysis must never create an execution risk. |
| A daily valuation snapshot is captured | It enables trustworthy future period returns even if the broker does not expose historical NAV. |
| CSV import remains a recovery and validation route | It permits backfill and diagnosis without disclosing credentials. |

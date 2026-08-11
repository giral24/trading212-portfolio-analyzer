# Validation Backlog Before Live Credentials

## Required evidence

Perform these checks with a demo Trading 212 account or a sanitized export. Do not submit a live API key into chat, source control, or test fixtures.

1. Capture one successful response for every endpoint in [the API contract](../02-data-and-integration/01-trading212-contract.md), redacting IDs and values before retaining fixtures.
2. Verify actual account-summary fields for cash, investments, total value, broker realised/unrealised P&L, currency, and timestamp semantics.
3. Verify position fields: quantity precision, average price, current price/value, instrument identifiers, and whether closed positions are absent.
4. Identify whether historical orders are order-level or fill-level; include a partial fill, cancel, purchase, and sale where available.
5. Map each cash transaction provider type and its amount sign: deposit, withdrawal, fee, tax, interest, correction, transfer, and unknown.
6. Inspect dividend data for gross amount, withholding, net amount, currency, pay date, and fractional-share rounding.
7. Request a historical export. Record exact CSV headers, encoding, decimal/date format, report lifecycle, and all available included-data options.
8. Confirm pagination order and prove use of returned `nextPagePath` across at least two pages.
9. Record the current rate-limit headers and endpoint limits from responses; make the adapter configurable instead of hardcoding unsupported assumptions.
10. Compare a complete imported period with Trading 212 summary/statement: cash, position quantity, total value, dividends, fees, and number of events.
11. Find at least one corporate action, correction, reinvested dividend, or otherwise document an absence; ensure it becomes an explicit review case.
12. Decide reporting timezone, daily snapshot cutoff, start/end-of-day cash-flow convention, and whether local IP restriction is practical for the current network.

## Output

For each item, store only a sanitized fixture and a short field map in a future `docs/05-research/observations/` note. Mark implementation assumptions as confirmed, changed, or unsupported. A failed check blocks only the feature that depends on it; it must never result in guessed accounting values.

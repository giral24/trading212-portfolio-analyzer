# Trading 212 adapter shape validation gap

Reviewed official API reference on 2026-08-10: account summary, positions, historical events/pagination, report workflow, and rate-limit headers.

The adapter validates only documented structural envelopes: historical `items` plus `nextPagePath`, and export `reportId`. Historical item fields, position rows, and report-list fields remain raw `unknown` JSON until a demo-account response or sanitized export validates their exact names, types, and sign conventions. No provider business fields were invented for this implementation.

# Trading 212 Portfolio Analyzer — Documentation

This directory is the project vault. Read the linked documents in order before implementation. Each note has one responsibility and uses ordinary Markdown links so it works in GitHub and Obsidian.

## Start here

1. [Product vision and scope](00-foundations/01-vision-and-scope.md)
2. [Decisions, glossary, and invariants](00-foundations/02-decisions-and-glossary.md)
3. [Financial calculations](01-financial-domain/01-metrics-and-formulas.md)
4. [Trading 212 contract](02-data-and-integration/01-trading212-contract.md)
5. [Architecture and data model](02-data-and-integration/02-architecture-and-data-model.md)
6. [Security and synchronization](02-data-and-integration/03-security-sync-and-operations.md)
7. [Product experience](03-product-and-design/01-information-architecture.md)
8. [Dark visual system](03-product-and-design/02-dark-design-system.md)
9. [Delivery roadmap](04-delivery/01-roadmap-and-acceptance.md)
10. [Implementation plan](superpowers/plans/2026-08-10-portfolio-analyzer.md)

## Directory map

```text
docs/
├── 00-foundations/          # purpose, constraints, vocabulary, decisions
├── 01-financial-domain/     # accounting rules and return calculations
├── 02-data-and-integration/ # API contract, storage, sync, security
├── 03-product-and-design/   # screens, behavior, visual system
├── 04-delivery/             # scope, milestones, acceptance gates
├── 05-research/             # validation work before implementation
└── superpowers/plans/        # executable engineering plan
```

## Document rules

- Update the relevant note in the same change as a behavior or methodology decision.
- Never add API keys, account exports, account numbers, or personal financial data to this tree.
- Link to primary sources and date time-sensitive findings.
- A claim marked **decision** is binding until explicitly superseded. A claim marked **validation** must be tested against a demo or sanitized export before being relied on.


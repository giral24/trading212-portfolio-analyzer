# Repository Guidelines

## Project Status and Scope

This repository is in the discovery phase for a personal Trading 212 portfolio-analysis application. It will distinguish investor cash flows from investment performance and separate actual results from future projections. Do not assume a final framework, data model, or provider integration until documented.

## Canonical Project Context

Start with [docs/README.md](docs/README.md) before changing product, calculation, data, integration, or UI behavior. The documents beneath `docs/` are the source of truth for this project: follow their glossary, scope boundaries, security constraints, and acceptance criteria. `AGENTS.md` is the concise contributor guide for Codex; a duplicate `CLAUDE.md` is intentionally not maintained.

## Project Structure & Module Organization

Keep the repository organized by responsibility. Place application code in `src/`, tests alongside it or in `tests/`, and static assets in an explicit assets directory. Keep business rules—cash-flow classification, returns, and projections—separate from API clients and UI components. Do not version generated files, credentials, or account exports.

## Build, Test, and Development Commands

No build system has been selected. When tooling is introduced, document canonical commands here and in the README for local development, builds, linting/formatting, and tests. Prefer reproducible commands such as `npm run test` over one-off scripts.

## Coding Style & Naming Conventions

Use the adopted formatter and linter. Prefer clear domain names: `cashFlow`, `realizedGain`, `timeWeightedReturn`, and `projectionScenario`. Keep modules focused and make financial units explicit. Use a precision-safe representation for money where accuracy matters.

## Testing Guidelines

Test financial calculations independently of APIs and UI code. Cover deposits, withdrawals, reinvested proceeds, partial sales, dividends, fees, missing history, and changing positions. Name tests after behavior, for example: `calculates_return_without_counting_deposits_as_gain`. Add a regression test for every corrected calculation.

## Commit & Pull Request Guidelines

There is no established commit history. Use concise, imperative subjects, such as `Add cash flow classification rules`, and keep changes focused. Pull requests should explain impact, list validation, link relevant decisions or issues, and include UI screenshots. Never include API tokens, account exports, or personal financial data.

## Security & Configuration

Store credentials only in local environment configuration and provide a sanitized example file when needed. Treat imported brokerage data as sensitive; minimize collection, restrict logs, and redact values in bug reports and tests.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dark Design System

## Direction

Use a restrained **midnight ledger** aesthetic: calm, precise, editorial, and private. It is not a neon trading terminal. Dense financial data is organized with generous rhythm, thin silver rules, tabular numbers, and high-contrast hierarchy.

The memorable visual element is the long-running portfolio line: a quiet silver trace over an almost-black chart field, with deposits and withdrawals as small disciplined event marks rather than celebratory signals.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--surface-base` | `#090A0C` | App background |
| `--surface-raised` | `#111318` | Cards and panels |
| `--surface-hover` | `#171A20` | Interactive states |
| `--line-subtle` | `#2B3038` | Borders and chart grid |
| `--text-primary` | `#F3F5F7` | Primary text |
| `--text-secondary` | `#AAB1BA` | Labels and helper text |
| `--text-muted` | `#737B86` | Metadata |
| `--silver` | `#CCD2D9` | Key non-semantic emphasis |
| `--positive` | `#72B99B` | Positive values, with sign/text |
| `--negative` | `#D87B78` | Negative values, with sign/text |
| `--warning` | `#D5A85A` | Incomplete data or caution |
| `--info` | `#7DA4C8` | Selection and information |
| `--projection` | `#9B8DCC` | Hypothetical-only accent |

Text never uses pure white across large areas. Numerical columns use tabular figures, right alignment, consistent decimal precision, and a nonbreaking space between number and currency where locale requires it.

## Typography and layout

Pair a characterful editorial display face such as **DM Serif Display** for page titles and key-value moments with **IBM Plex Sans** for interface/body text and **IBM Plex Mono** only for compact identifiers and timestamps. Load only the subsets actually used and provide robust fallbacks.

Use an 8px spacing scale, 12px card radius, 1px low-contrast borders, and restrained shadows. Desktop data pages use a 12-column grid; cards should not create a wall of equal panels. On small screens, preserve context labels beside every number and use expandable list rows.

## Components

- **Metric card:** label, amount, method/period, trend, confidence badge, methodology link.
- **Confidence badge:** Actual, Estimated, Incomplete, Hypothetical, or Review needed; colour plus text.
- **Data table:** sticky semantic header, sorting, filters, row detail, accessible currency cells.
- **Timeline/chart:** muted grid, silver primary line, semantic event markers, visible legend, table fallback.
- **Button hierarchy:** silver primary for consequential navigation/action; low-emphasis secondary; destructive red only after confirmation.
- **Panel detail:** uses a side sheet on desktop and bottom sheet on mobile.

## Motion

Motion explains state, not market excitement: short opacity/position transitions for loading cards, sync stages, and drawer opening. Respect `prefers-reduced-motion`; do not animate numbers as slot machines or use flashing gain/loss cues.

## Content style

Use precise labels: `Resultado de inversión`, `Aportado neto`, `Rentabilidad de cartera (TWR)`, and `Hipotético`. Avoid “victoria”, “mejor activo”, “señal”, “oportunidad”, or red/green arrows without period and method.


# Timewinder

Ranked ladder distribution viewer for League of Legends. Shows player counts and percentile breakdowns across every tier and division for NA and EUW, plus historical trends going back to 2019.

**Live site:** [nextechlol.github.io/Timewinder](https://nextechlol.github.io/Timewinder/)

## What it does

**Snapshot view** - Current ladder state broken down by tier and division. Toggle between raw player counts and "Top X%" percentiles. Switch between global scaling (all bars relative to the largest division) and per-tier scaling (bars scaled within their own tier) to zoom into less populated ranks.

**Historical view** - Two modes:
- *Distribution* - Side-by-side rank distribution for each year, with year-over-year deltas
- *Trends* - Line chart showing how each tier's ladder share has shifted from 2019 to 2026

Both views support tier filtering and region switching (NA / EU).

## Stack

- React 18 + TypeScript (strict)
- Vite 6
- Vanilla CSS with custom properties - no component library, no Tailwind
- All charts are hand-rolled (no charting library)
- Static site, no backend - data is baked in at build time

## Data pipeline

Raw data lives in CSV files under `data/` (`na_snapshot.csv`, `euw_snapshot.csv`, `na_ladder_historical.csv`, `eu_ladder_historical.csv`). A build-time script (`scripts/convert-csv.ts`) parses these into typed TypeScript modules under `src/data/generated/`. No API calls at runtime.

To update the data, replace the CSVs and rebuild.

## Running locally

```bash
npm install
npm run dev
```

This converts the CSVs and starts Vite's dev server.

## Building

```bash
npm run build
```

Runs the CSV conversion, type-checks with `tsc`, and bundles with Vite. Output goes to `dist/`.

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds and deploys to GitHub Pages.

## Project structure

```
src/
  App.tsx                          Root component - region + view tabs
  App.css                          All styles
  components/
    BarChart.tsx                    Reusable horizontal bar chart
    TierFilterPills.tsx             Tier toggle buttons
    Tooltip.tsx                     Hover tooltip
    snapshot/SnapshotView.tsx       Current ladder view
    historical/
      HistoricalView.tsx            Container for historical sub-views
      DistributionView.tsx          Year-by-year rank distribution
      TrendChart.tsx                SVG line chart
  data/
    types.ts                        Core interfaces (SnapshotEntry, HistoricalEntry, etc.)
    tiers.ts                        Tier colors and labels
    index.ts                        Data loading + utility functions
    generated/                      Auto-generated from CSVs (not committed)
scripts/
  convert-csv.ts                    CSV → TypeScript converter
```

## License

MIT - see [LICENSE](LICENSE).

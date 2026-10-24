# DapurPlan synthetic test data

Synthetic CSV fixtures aligned with the current DapurPlan spreadsheet API and seeded menu and ingredient catalogue. They use the column names and value formats currently exported by the app.

## Coverage

- Sales and expenses: 2025-10-01 through 2026-10-24 (inclusive), with one row for each of the five current menu IDs per sales date.
- Inventory: 17 stock-tracked ingredients; water is excluded because it is not stock-tracked.
- Ingredient prices: all 18 current ingredient IDs, with the configured baseline units and quantities (including 30 eggs and 100 tea bags).
- Recipes: the current five seeded recipes and their 26 ingredient lines, with synthetic menu prices for sales/profit testing.
- Planning: a representative 22-row export-shaped sample. Planning can be exported from the spreadsheet page but is intentionally not importable.

## Assumptions

- Sales, expense, and ingredient-price versions are initialized for import into a fresh current-version database. The sales and expense history spans 2025-10-01 through today (2026-10-24). Recipe versions match the current seeded recipes; importing adds the synthetic menu prices.
- Inventory rows have blank batch IDs and versions so the importer creates new stock batches. Import this inventory fixture once; download a fresh export before editing or re-importing those batches.
- Expense IDs are fixture identifiers; the current importer assigns IDs when saving expenses.
- Planning quantities use the current export units (base units such as `g`, `ml`, and `pieces`) and the current `draft` status.
- All dates are ISO `YYYY-MM-DD`, monetary amounts are RM, and all records are synthetic. Do not use these fixtures for accounting or operational decisions.

## Files and use

Import recipes, ingredient-prices, inventory, sales, and expenses in that order using their matching spreadsheet page import types. This lets sales capture the synthetic prices and ingredient costs. Planning is export-only and will be rejected if uploaded. The fixtures are sized below the current 1 MB and 5,000-row upload limits. Use a fresh test database for repeatable runs; imports update real application data.

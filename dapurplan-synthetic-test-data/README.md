# DapurPlan synthetic test data

Generated CSV copies based on the six uploaded DapurPlan files. Originals were left untouched.

## Coverage

- Sales, planning, and expenses: 2026-01-01 through 2026-10-24 (inclusive).
- Inventory: end-of-period stock snapshot dated 2026-10-24.
- Ingredient prices and recipes: one reference table each, preserving the uploaded schemas and identifiers. Price costs use a modest 2.5% synthetic uplift; no historical price column exists in the source schema.

## Assumptions

- Sales are generated per menu per day using plausible volume variation and weekend uplift. Sold-out is a rare flag.
- Planning includes a menu row per date/menu and ingredient requirement rows aggregated from recipes and planned servings. Quantity units follow recipe rows.
- Expenses are plausible day-to-day operating costs across several categories.
- Inventory contains one lot per stock-tracked ingredient; water is omitted because the source marks it as not stock-tracked. Expiry dates vary by ingredient.
- All IDs and menu/ingredient references match the source recipe and ingredient tables. This data is synthetic and intended for import/testing, not accounting or operational use.

## Files and use

Import the six CSV files using the matching DapurPlan import screens. Keep the uploaded originals as a separate backup. Use UTF-8 CSV; dates are ISO `YYYY-MM-DD`; monetary amounts are RM.

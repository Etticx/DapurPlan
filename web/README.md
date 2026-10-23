# DapurPlan web

Next.js + TypeScript frontend and backend for the DapurPlan hackathon prototype.

## Run locally

```sh
cd web
npm install
npm run dev
```

Open the local URL printed by Next.js. Use Node.js 22 (tested with 22.12.0) or newer.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS 4 with a white/light-blue theme
- Geist Sans, loaded from the installed open-source font package
- shadcn/ui component conventions and Lucide icons

The root uv project stays in place for the later Python model service.
The web app lives in this folder; do not move or replace the Python package.

## Check

```sh
npm run typecheck
npm run build
```

## Incremental development

1. Project foundation and theme.
2. Prototype owner login.
3. Daily sales entry and saved records (later).
4. Forecast, recipes, stock and reviewed purchases (later).

Replit hosting and Runpod inference are later integration steps.

## Prototype login

- Username: `owner`
- Password: `123`
- `/login` accepts the demo account; `/home` checks the signed session on the server.
- Sign out clears the HttpOnly session cookie; sessions expire after 8 hours.
- This is simulated owner authentication for the prototype, not a real account system.
- `DEMO_SESSION_SECRET` protects session integrity only; it does not make the shared demo passwords safe.
- Keep the app private and bound to localhost. Do not expose the demo accounts to the public internet.
- Staff roles, real accounts and restaurant features are future commits.

UI primitives use shadcn/ui's open-code conventions (MIT), Radix Slot, CVA and Tailwind.
Icons are from Lucide; the kitchen illustration is an original SVG.


## Permanent recipe storage

Recipes now use SQLite (`better-sqlite3`) at `web/data/dapurplan.sqlite`.
Run `npm install`, then `npm run dev` inside `web/`; open http://localhost:4000.
Sign in with the existing demo owner account. First recipe access creates the schema,
five menus, shared ingredient catalogue and initial demo recipe versions in one
transaction. Later starts do not overwrite edited recipes. Saving creates a new
immutable-by-application snapshot with the server-derived owner identity and UTC time.
The UI displays Malaysia time. Inventory/ML are not connected.

Schema version 1: `menus`, `ingredients` (`stock_tracked=0` for water), `recipes`,
`recipe_lines`, `recipe_versions`, and `schema_migrations`. IDs match `src/lib/recipes.ts`.
Each recipe update checks its current version to reject stale edits and writes current
values, lines, and history atomically. Authenticated endpoints: GET `/api/recipes`,
PUT `/api/recipes/:id`, GET `/api/recipes/:id/history`.
Migration 5 adds an optional selling price in integer cents. Owners set menu prices in
Recipes; staff can view them. Menu price edits use the same versioned recipe history.

Database files, WAL journals and secrets are ignored by Git. Set `DAPURPLAN_DB_PATH`
to change the file location. Back up via SQLite's backup API or stop the app before
copying its database; copying an active database without its WAL can lose updates.

This is single-machine prototype storage, not a hosted shared database. Before Replit
deployment, use persistent storage guaranteed by that hosting setup or migrate to a
managed database such as PostgreSQL. Do not rely on an ephemeral deployment filesystem
or share this file across separate app instances. The existing shared demo owner account
is not multi-user production authentication. Recipe history is retained; a full activity
log screen and preparation records will be added separately.

Run recipe checks with `npm run test:recipes`. Tests use a temporary database, including a forced history-write failure to verify rollback.


## Inventory

Open `/inventory` after signing in. Closing counts are saved in the same SQLite
database as recipes. Schema migration 2 adds `inventory_batches`, `inventory_packs`,
and `inventory_history`. Saves and corrections (including pack settings and history)
are atomic. Existing batches require their current version; corrections retain history.
Owner-authenticated GET/POST `/api/inventory` load/save data. There is no sales deduction.

Use **Load demo stock** once on an empty inventory to add the agreed 17 ingredients
in 18 batches, including two chicken batches with separate hypothetical expiries.
Dates are relative to the Malaysia date when loaded. Other expiry dates remain blank
until checked against packaging. Demo provenance remains marked after correction.
An occupied inventory cannot be seeded, so demo loading never overwrites user stock.
Add only a batch's remaining amount, not the whole ingredient balance again. Set an
exhausted batch to zero; no permanent deletion is provided. Purchase pack settings
apply across batches of the ingredient. Owners can record the purchase cost per pack;
these costs are used for recipe cost estimates, not as an inventory deduction or
valuation of remaining stock. Water remains untracked for stock but has an optional
cost-per-litre setting. Pack costs are stored in integer cents; pieces require whole
numbers in stock.

Totals display recorded stock, including expired batches. No demand-based low-stock
claim, forecast, purchase suggestion or automatic stock deduction is implemented yet.
The dashboard stays a preview; preparation planning remains a separate feature.
Migration 7 adds optional ingredient pack cost. Migration 9 adds change history for
the untracked water cost. Run `npm run test:inventory` for isolated seed, validation,
cost persistence and rollback tests.


## Daily sales

Open `/sales` after signing in. Enter whole-number quantities for the five fixed
menus; blank is stored as NULL (not entered), while 0 is confirmed zero sales.
At least one quantity is required per save. Dates follow Malaysia time and cannot
be in the future. Owners configure per-serving selling prices in Recipes and ingredient
purchase pack costs in Inventory. Recipe costs derive from ingredient quantities,
pack sizes and pack costs. Set water cost per litre separately because water is not
stock-tracked. The recipe editor shows ingredient batch costs and estimated cost per
serving; missing prices leave totals explicitly incomplete.

Daily sales use one shared calculation for the page, saved summaries, and trends. Revenue
is each saved selling-price snapshot multiplied by servings sold. Ingredient cost of
sales is each saved per-serving recipe-cost snapshot multiplied by servings sold; it is
not based on servings prepared, ingredient purchases, stock counts, or inventory
movements. Recipe batch ingredient costs and per-serving costs are rounded to the nearest
sen when snapshots are created; saved money and displayed totals use integer sen.
Profit contribution per menu item is its revenue minus its ingredient cost of sales.
Gross profit is total revenue minus ingredient cost of sales. Profit margin is profit
divided by revenue and is unavailable when revenue is zero or an input is missing.

Recorded other operating expenses are kept separate from ingredient cost of sales.
Estimated net profit is gross profit minus the saved other-expense list, and remains
unavailable until that list is saved (save an empty list to confirm that no other
expenses were recorded). It is only an estimate, not complete accounting net profit:
expenses not recorded in DapurPlan are excluded. Missing prices, recipe costs, or
expense records are not treated as zero. Negative per-item contribution remains
negative and is highlighted. Record expenses by category, amount, and optional note.
Daily, weekly, and monthly trends use these same definitions. Expense edits use a
version check and are retained in application history.

The Daily sales screen places the selected Malaysia business date and record status
first, followed by the keyboard-accessible sales table and summary cards for revenue,
servings, ingredient cost of sales and gross profit. A separate profit estimate shows
estimated net profit; menu-level financial detail follows, with recipe ingredient
breakdown expanded only when requested. Historical records and trends are inside a
collapsible section. Totals update while editing; invalid quantity text remains in its
field with a local correction message. Save is version checked, and Cancel asks before
discarding edits. Historical imported rows are identified as imported data; the sales
form does not show a date-specific demo prompt.
The estimate lists the saved expense categories and amounts it includes, identifies
missing sold-item prices or ingredient costs, and links to the relevant correction
screen. Ingredient-price links open and focus the selected price field. Unsaved expense
edits are not described as included. A negative item contribution means estimated
ingredient cost exceeds revenue; this can reflect recipe or cost data as well as price.

Each sale snapshots the selling price, recipe quantities, ingredient prices and
estimated ingredient cost per serving on first entry. Corrections keep those original
cost snapshots, so later recipe or ingredient-price edits do not rewrite past estimates.
Missing selling or ingredient costs are shown as incomplete, not treated as zero. Sales
and optional sold-out flags never deduct stock and do not yet feed a model. No sales are
seeded automatically.

Schema migrations 3 and 4 add sales records, versioned history and demo provenance;
migration 6 adds per-item selling-price snapshots, and migration 8 adds recipe-cost
snapshots and daily expense/history tables. Sales and expense updates are atomic and
reject stale versions. Authenticated GET `/api/sales?date=YYYY-MM-DD&trend=daily`
returns the selected date, previous day, latest records and requested trend. POST
`/api/sales` saves the complete five-row form; POST `/api/sales/expenses` replaces that
date’s expense list. Owner and staff sessions can record sales and expenses; only
owners can change selling and purchase prices.
Partial days are visibly marked and must not be treated as complete training data.
Use the date picker for older records. Run `npm run test:sales` to verify validation,
price/cost snapshots, expenses, profit aggregation, trends, correction history,
rollback and unchanged inventory.


### Ingredient prices

Inventory has a separate Ingredient prices editor. Owners set MYR per kg, litre, carton of 30 eggs, bag of tea or lemon. Staff can view prices. Demo prices are hypothetical; water is RM0/litre, with its utility bill recorded separately. Blank means unknown. Stock batches still hold closing quantities and expiry dates, while purchase pack sizes determine shopping quantities.

Prices are stored separately in `ingredient_prices`, with version checks and atomic ingredient-cost history. Migration 10 converts existing pack costs once to baseline prices, rounded to the nearest sen. Migration 11 converts existing per-egg prices to a carton of 30 without changing their cost per egg. Subsequent startups preserve saved prices. Recipe costing and new sales use these prices independently of pack sizes. Historical sales keep their original snapshots, including missing costs; this change does not backfill them. The old pack-cost columns and water endpoint remain for compatibility. New screens use the owner-only `save-ingredient-price` action.

Migration 12 changes tea pricing to a bag (RM12 demo). The price screen hides the individual tea-bag count. Internally one price bag contains 100 tea bags, matching the existing purchase pack, so recipes using 10 tea bags still cost RM1.20 in tea. Existing saved prices are converted once, preserving their effective cost per tea bag.

On Daily sales, owners can use **Fill missing prices and costs** for the selected saved date. The action copies only missing financial values from current menu prices and recipe costs; existing financial values, servings, stock and provenance stay unchanged. All updates and the sales-history entry are atomic and version checked. Positive sales with unavailable current prices/costs reject the correction. Other historical dates are not automatically changed. Financial corrections increment the sales revision, so existing forecasts based on that revision may require regeneration.


## Spreadsheet CSV exchange

Open **Spreadsheet data** to download current CSV files and import edited copies.
This first spreadsheet workflow is an explicit export/edit/import exchange, not a
live-connected workbook or a second database. The existing SQLite stores remain the
source of truth; successful imports use the same versioned sales, expense, inventory,
recipe, and ingredient-price stores used by DapurPlan. Reports and forecasts therefore
use imported changes without a separate database sync.

CSV exports are available for daily sales, expenses, inventory batches, recipe
definitions/menu prices, ingredient prices, and the latest saved forecast/preparation
plan. Planning CSV is read-only because it is generated from current sales, recipe,
and stock inputs. Importing source data does not automatically regenerate a forecast
or approve a preparation plan.

Imports are limited to 1 MB and 5,000 rows. Upload size is enforced while reading,
including requests without a `Content-Length` header, and CSV text must be valid UTF-8.
Money fields accept no more than two decimal places rather than silently rounding
spreadsheet values. Keep the exported headers and IDs intact.
Version columns are checked against the latest saved record; changed records are
rejected with row-level errors instead of overwriting newer edits. Imports save by
record group, not as one all-or-nothing file: successful groups remain saved if other
groups fail. Review the result, download a fresh CSV, and resolve stale rows before
trying again.

Daily sales CSVs contain all five menu rows per saved date; blank servings mean not
entered and `0` means confirmed zero. Expense CSV import replaces the complete list
for each date; use one `clear-date` row to remove that date’s expenses. Inventory
rows with a batch ID correct that batch (owner only); rows without an ID add batches
(owner or staff). Setting quantity to zero preserves a batch’s history. Recipe
imports replace the full ingredient list for each menu. Only owners can import
ingredient prices or recipes; staff can import sales, expenses, and new stock batches.
CSV downloads protect formula-looking text cells for spreadsheet software.

Run `npm run test:spreadsheet` for CSV parsing, quoting, validation, and formula-cell
regression coverage. API access requires a signed-in session; spreadsheet imports
are subject to the same role checks and input validation as the web forms.
